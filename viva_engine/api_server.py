import asyncio
import base64
import json
import os
import random
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List

import cv2
import edge_tts
import numpy as np
import requests
import speech_recognition as sr
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from mutagen.mp3 import MP3
from pydantic import BaseModel
from pymongo import MongoClient

from llm_scoring import score_single_response, set_scoring_context

ROOT = Path(__file__).resolve().parent
BACKEND_ENV = ROOT.parent / "backend" / ".env"
load_dotenv(dotenv_path=BACKEND_ENV)
load_dotenv(dotenv_path=ROOT / ".env", override=False)

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError(f"MONGO_URI missing. Expected in {BACKEND_ENV}")

NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:5000")

client = MongoClient(MONGO_URI)
db = client["test"]
tests_collection = db["tests"]
questions_collection = db["questions"]
answers_collection = db["testanswers"]

CASCADE = str(ROOT / "haarcascade_frontalface_default.xml")
FACE_CASCADE = cv2.CascadeClassifier(CASCADE) if os.path.exists(CASCADE) else None

INTERVIEWS_DIR = ROOT / "interviews"
INTERVIEWS_DIR.mkdir(parents=True, exist_ok=True)
IST = timezone(timedelta(hours=5, minutes=30))

RECORDING_DURATION = 30


class VivaSessionInit(BaseModel):
    testId: str
    studentId: str


class ConfirmIdPayload(BaseModel):
    candidateId: str


class FeedbackPayload(BaseModel):
    rating: int
    recommendation: str = ""


class IncidentPayload(BaseModel):
    incident_type: str
    details: Dict[str, Any] = {}
    phase: str = ""
    timestamp: str = ""


class SnapshotPayload(BaseModel):
    image_base64: str
    mode: str = "monitor"


class AnswerPayload(BaseModel):
    audio_base64: str


class SessionStore:
    def __init__(self) -> None:
        self._sessions: Dict[str, Dict[str, Any]] = {}

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        sid = uuid.uuid4().hex
        data["session_id"] = sid
        self._sessions[sid] = data
        return data

    def get(self, sid: str) -> Dict[str, Any]:
        session = self._sessions.get(sid)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return session

    def find_latest_for_candidate(self, test_id: str, student_id: str) -> Dict[str, Any] | None:
        for _, session in reversed(self._sessions.items()):
            if session.get("test_shared_id") == test_id and session.get("student_id") == student_id:
                return session
        return None


SESSIONS = SessionStore()


def _transcribe_audio(path: Path) -> str:
    if not path.exists() or path.stat().st_size <= 44:
        return "No audio file."
    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(str(path)) as src:
            audio = recognizer.record(src)
        return recognizer.recognize_google(audio)
    except sr.UnknownValueError:
        return "Could not understand audio."
    except sr.RequestError as err:
        return f"API error: {err}"
    except Exception as err:
        return f"Transcription error: {err}"


def _safe_name(name: str) -> str:
    return "".join(ch for ch in name if ch.isalnum() or ch in ("_", "-", "."))


def _pre_synthesize_questions(questions: List[str], out_dir: Path, voice: str = "en-IN-NeerjaNeural") -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for idx, question in enumerate(questions, start=1):
        path = out_dir / f"q{idx}.mp3"
        if path.exists():
            continue
        for _ in range(3):
            try:
                asyncio.run(edge_tts.Communicate(question, voice).save(str(path)))
                break
            except Exception:
                time.sleep(1.5)

    welcome = out_dir / "welcome.mp3"
    if not welcome.exists():
        text = "Welcome to this Examination. Please listen carefully and answer within the time limit."
        asyncio.run(edge_tts.Communicate(text, "en-IN-PrabhatNeural").save(str(welcome)))


def _analyze_face_and_log(session: Dict[str, Any], raw_bytes: bytes, mode: str) -> Dict[str, Any]:
    if FACE_CASCADE is None:
        return {"status": "unknown", "faces": 0, "ready": False}

    np_buffer = np.frombuffer(raw_bytes, dtype=np.uint8)
    np_arr = cv2.imdecode(np_buffer, cv2.IMREAD_COLOR)
    if np_arr is None:
        return {"status": "unknown", "faces": 0, "ready": False}

    gray = cv2.cvtColor(np_arr, cv2.COLOR_BGR2GRAY)
    faces = FACE_CASCADE.detectMultiScale(gray, 1.1, 5, minSize=(80, 80))
    count = int(len(faces))
    if count == 0:
        status = "no_face"
    elif count == 1:
        status = "ok"
    else:
        status = "multi_face"

    ts = int(time.time())
    snap_name = f"snapshot_{ts}.jpg"
    snap_path = Path(session["attempt_dir"]) / snap_name
    cv2.imwrite(str(snap_path), np_arr)

    log_path = Path(session["attempt_dir"]) / "face_log.json"
    entry = {"timestamp": datetime.now().isoformat(), "status": status, "snapshot": snap_name, "mode": mode}
    logs: List[Dict[str, Any]] = []
    if log_path.exists():
        try:
            logs = json.loads(log_path.read_text(encoding="utf-8"))
        except Exception:
            logs = []
    logs.append(entry)
    log_path.write_text(json.dumps(logs, indent=2), encoding="utf-8")

    ready = status == "ok"
    if mode == "check" and ready:
        session["camera_checked"] = True
    return {"status": status, "faces": count, "ready": ready}


def _question_payload(session: Dict[str, Any]) -> Dict[str, Any]:
    q_idx = session["current_q"]
    total = len(session["questions"])
    done = q_idx >= total
    if done:
        return {"done": True, "index": q_idx, "total": total}
    q_audio = Path(session["attempt_dir"]) / f"q{q_idx + 1}.mp3"
    q_duration = 0.0
    if q_audio.exists():
        try:
            q_duration = float(MP3(str(q_audio)).info.length)
        except Exception:
            q_duration = 0.0
    return {
        "done": False,
        "index": q_idx,
        "number": q_idx + 1,
        "total": total,
        "question": session["questions"][q_idx],
        "audio_url": f"/api/viva/session/{session['session_id']}/audio/{q_audio.name}",
        "audio_duration": q_duration,
        "recording_duration": RECORDING_DURATION,
    }


def _finalize_and_submit(session: Dict[str, Any]) -> Dict[str, Any]:
    attempt_dir = Path(session["attempt_dir"])
    responses_path = attempt_dir / "responses.json"
    responses_path.write_text(json.dumps(session["responses"], indent=2), encoding="utf-8")

    scored_path = attempt_dir / "scored_responses.json"
    if scored_path.exists():
        scored = json.loads(scored_path.read_text(encoding="utf-8"))
    else:
        scored = []

    question_averages = [item.get("average_score", -1) for item in scored if item.get("average_score", -1) >= 0]
    total_score = round(sum(question_averages) / len(question_averages), 2) if question_averages else -1

    qa_pairs = [{"question": r["question"], "answer": r.get("transcript", "")} for r in session["responses"]]
    similarities = [None for _ in qa_pairs]

    payload = {
        "testId": session["test_shared_id"],
        "candidateId": session["student_id"],
        "vivaDate": str(datetime.now()),
        "questionAnswerPairs": qa_pairs,
        "totalScore": total_score,
        "questionAverages": question_averages,
        "detailedBreakdown": scored,
        "cosineSimilarities": similarities,
    }
    try:
        requests.post(f"{NODE_BACKEND_URL}/api/submit-viva", json=payload, timeout=10)
    except Exception:
        pass

    obtained_raw = sum(question_averages)
    obtained = int(round(obtained_raw))
    total_marks = len(question_averages) * 10
    percentage = int(round((obtained / total_marks) * 100)) if total_marks > 0 else 0

    def grade(percent: float) -> Dict[str, str]:
        if percent >= 80:
            return {"grade": "A+", "message": "Outstanding performance! You clearly know your fundamentals."}
        if percent >= 70:
            return {"grade": "A", "message": "Excellent work. Your understanding is strong and well-demonstrated."}
        if percent >= 60:
            return {"grade": "B+", "message": "Very good effort. A little refinement can take you to excellence."}
        return {"grade": "B", "message": "Good attempt. Strengthen core concepts for better results."}

    gm = grade(percentage)
    return {
        "summary": {
            "obtained_marks": obtained,
            "total_marks": total_marks,
            "percentage": percentage,
            "grade": gm["grade"],
            "message": gm["message"],
            "question_averages": question_averages,
        },
        "detailed": scored,
    }


def _log_incident(session: Dict[str, Any], payload: IncidentPayload) -> None:
    attempt_dir = Path(session["attempt_dir"])
    attempt_dir.mkdir(parents=True, exist_ok=True)
    log_path = attempt_dir / "incident_log.json"
    ts = datetime.now(IST)
    if payload.timestamp:
        try:
            raw = payload.timestamp
            # Accept "Z" suffix and normalize to explicit UTC offset for parsing.
            if raw.endswith("Z"):
                raw = raw.replace("Z", "+00:00")
            parsed = datetime.fromisoformat(raw)
            if parsed.tzinfo is None:
                # If timestamp is naive, interpret it as UTC.
                parsed = parsed.replace(tzinfo=timezone.utc)
            ts = parsed.astimezone(IST)
        except Exception:
            ts = datetime.now(IST)

    entry = {
        "timestamp": ts.isoformat(),
        "incident_type": payload.incident_type,
        "phase": payload.phase,
        "details": payload.details or {},
    }
    logs: List[Dict[str, Any]] = []
    if log_path.exists():
        try:
            logs = json.loads(log_path.read_text(encoding="utf-8"))
        except Exception:
            logs = []
    logs.append(entry)
    log_path.write_text(json.dumps(logs, indent=2), encoding="utf-8")

    # Strict enforcement: leaving/refreshing during active interview ends the attempt.
    terminating_incidents = {"page_unload", "page_refresh_attempt"}
    if (
        payload.incident_type in terminating_incidents
        and session.get("interview_started")
        and not session.get("terminated")
        and session.get("current_q", 0) < len(session.get("questions", []))
    ):
        session["terminated"] = True
        session["terminated_reason"] = payload.incident_type


app = FastAPI(title="Viva Engine API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/_stcore/health")
def stcore_health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/_stcore/host-config")
def stcore_host_config() -> Dict[str, Any]:
    return {}


@app.post("/api/viva/session/init")
def init_session(payload: VivaSessionInit) -> Dict[str, Any]:
    test_id = payload.testId.strip()
    student_id = payload.studentId.strip()
    if not test_id or not student_id:
        raise HTTPException(status_code=400, detail="Missing testId or studentId")

    test = tests_collection.find_one({"sharedLinkId": test_id})
    if not test:
        raise HTTPException(status_code=404, detail="Invalid Test ID")

    existing = SESSIONS.find_latest_for_candidate(test_id=test_id, student_id=student_id)
    if existing:
        return {
            "session_id": existing["session_id"],
            "test_description": existing.get("test_description", "No description available"),
            "question_count": len(existing.get("questions", [])),
            "recording_duration": RECORDING_DURATION,
            "resumed": True,
        }

    qids = [ObjectId(x) for x in test.get("questions", [])]
    question_docs = list(questions_collection.find({"_id": {"$in": qids}}))
    qmap = {str(q["_id"]): q.get("questionText", "Error") for q in question_docs}
    questions = [qmap.get(str(qid), "Error") for qid in qids]
    if not questions:
        raise HTTPException(status_code=400, detail="No questions resolved")

    answers_data = list(answers_collection.find({"testId": ObjectId(test["_id"])}))
    reference_answers = [a.get("answerText", "") for a in answers_data]

    attempt_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    attempt_dir = INTERVIEWS_DIR / f"{_safe_name(student_id)}_{attempt_id}"
    attempt_dir.mkdir(parents=True, exist_ok=True)
    (attempt_dir / "incident_log.json").write_text("[]", encoding="utf-8")

    session = SESSIONS.create(
        {
            "test_shared_id": test_id,
            "test_description": test.get("description", "No description available"),
            "student_id": student_id,
            "questions": questions,
            "reference_answers": reference_answers,
            "attempt_dir": str(attempt_dir),
            "current_q": 0,
            "responses": [],
            "id_confirmed": False,
            "rules_accepted": False,
            "camera_checked": False,
            "interview_started": False,
            "terminated": False,
            "face_interval": random.randint(8, 15),
            "last_face_check": 0.0,
        }
    )

    _pre_synthesize_questions(questions, attempt_dir)

    return {
        "session_id": session["session_id"],
        "test_description": session["test_description"],
        "question_count": len(questions),
        "recording_duration": RECORDING_DURATION,
    }


@app.get("/api/viva/session/{session_id}/state")
def get_state(session_id: str) -> Dict[str, Any]:
    s = SESSIONS.get(session_id)
    return {
        "id_confirmed": s["id_confirmed"],
        "rules_accepted": s["rules_accepted"],
        "camera_checked": s["camera_checked"],
        "interview_started": s["interview_started"],
        "terminated": s["terminated"],
        "current_question": s["current_q"],
        "total_questions": len(s["questions"]),
    }


@app.post("/api/viva/session/{session_id}/confirm-id")
def confirm_id(session_id: str, payload: ConfirmIdPayload) -> Dict[str, Any]:
    s = SESSIONS.get(session_id)
    ok = payload.candidateId.strip() == s["student_id"]
    if ok:
        s["id_confirmed"] = True
    return {"ok": ok}


@app.post("/api/viva/session/{session_id}/accept-rules")
def accept_rules(session_id: str) -> Dict[str, bool]:
    s = SESSIONS.get(session_id)
    s["rules_accepted"] = True
    return {"ok": True}


@app.post("/api/viva/session/{session_id}/proctor-snapshot")
def proctor_snapshot(session_id: str, payload: SnapshotPayload) -> Dict[str, Any]:
    s = SESSIONS.get(session_id)
    try:
        data = base64.b64decode(payload.image_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image payload")
    if not data:
        raise HTTPException(status_code=400, detail="Empty snapshot")
    return _analyze_face_and_log(s, data, payload.mode)


@app.post("/api/viva/session/{session_id}/start-test")
def start_test(session_id: str) -> Dict[str, Any]:
    s = SESSIONS.get(session_id)
    if not (s["id_confirmed"] and s["rules_accepted"] and s["camera_checked"]):
        raise HTTPException(status_code=400, detail="Entry gates not completed")
    s["interview_started"] = True
    return {
        "welcome_audio_url": f"/api/viva/session/{session_id}/audio/welcome.mp3",
        "question": _question_payload(s),
    }


@app.get("/api/viva/session/{session_id}/question/current")
def current_question(session_id: str) -> Dict[str, Any]:
    s = SESSIONS.get(session_id)
    return _question_payload(s)


@app.post("/api/viva/session/{session_id}/answer")
def submit_answer(session_id: str, payload: AnswerPayload) -> Dict[str, Any]:
    s = SESSIONS.get(session_id)
    if s["terminated"]:
        raise HTTPException(status_code=400, detail="Interview already submitted")
    q_idx = s["current_q"]
    if q_idx >= len(s["questions"]):
        raise HTTPException(status_code=400, detail="No pending questions")

    attempt_dir = Path(s["attempt_dir"])
    audio_path = attempt_dir / f"q{q_idx + 1}_answer.wav"
    try:
        content = base64.b64decode(payload.audio_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid audio payload")
    audio_path.write_bytes(content)

    transcript = _transcribe_audio(audio_path).strip()
    question = s["questions"][q_idx]

    s["responses"].append(
        {
            "question_number": q_idx + 1,
            "question": question,
            "audio_file": str(audio_path.resolve()),
            "transcript": transcript,
        }
    )

    set_scoring_context(test_description=s["test_description"], attempt_dir=s["attempt_dir"])
    scored = score_single_response(s["student_id"], question, transcript)

    s["current_q"] += 1
    return {
        "transcript": transcript,
        "scoring": scored,
        "question": _question_payload(s),
    }


@app.post("/api/viva/session/{session_id}/submit")
def submit_interview(session_id: str) -> Dict[str, Any]:
    s = SESSIONS.get(session_id)
    if s["current_q"] < len(s["questions"]):
        raise HTTPException(status_code=400, detail="Interview not complete yet")
    s["terminated"] = True
    result = _finalize_and_submit(s)
    return result


@app.post("/api/viva/session/{session_id}/feedback")
def submit_feedback(session_id: str, payload: FeedbackPayload) -> Dict[str, Any]:
    s = SESSIONS.get(session_id)
    out = {
        "candidateId": s["student_id"],
        "rating": payload.rating,
        "recommendation": payload.recommendation,
        "timestamp": str(datetime.now()),
    }
    r = requests.post(f"{NODE_BACKEND_URL}/api/feedback/platform", json=out, timeout=10)
    if r.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail=f"Feedback save failed: {r.text}")
    return {"ok": True}


@app.post("/api/viva/session/{session_id}/incident")
def log_incident(session_id: str, payload: IncidentPayload) -> Dict[str, bool]:
    s = SESSIONS.get(session_id)
    _log_incident(s, payload)
    return {"ok": True}


@app.get("/api/viva/session/{session_id}/audio/{filename}")
def get_audio(session_id: str, filename: str) -> FileResponse:
    s = SESSIONS.get(session_id)
    path = Path(s["attempt_dir"]) / _safe_name(filename)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    media_type = "audio/mpeg" if path.suffix.lower() == ".mp3" else "audio/wav"
    return FileResponse(str(path), media_type=media_type)
