
// routes/examiner.js
import express from "express";
import {
   inviteStudents,
   removeStudent,
   getTestStudents
} from "../controllers/examinerController.js";

import { verifyToken, authorizeRoles } from "../middlewares/authMiddleware.js"
import { addPendingEvaluator } from "../controllers/evaluatorController.js";

const router = express.Router();

router.post("/invite-evaluator/:testId", verifyToken, authorizeRoles("examiner"), addPendingEvaluator)
// router.post("/invite/:testId", verifyToken, authorizeRoles("examiner"), inviteStudents);
router.post("/remove/:testId", verifyToken, authorizeRoles("examiner"), removeStudent);
router.get("/test/:testId/students", verifyToken, authorizeRoles("examiner"), getTestStudents);


export default router;