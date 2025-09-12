import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from "jsonwebtoken"

import Test from "../models/Test.js";
import Examiner from "../models/Examiner.js";
import transporter from "../utils/mailer.js";
import { sendEvaluatorInviteMail, sendEvaluatorAssignmentMail } from '../utils/evaluatorMailTemplate.js';
import Evaluator from '../models/Evaluator.js';
import TestAttempt from '../models/TestAttempt.js';
import VivaResult from '../models/VivaResult.js';
import EvaluatorResponse from '../models/EvaluatorResponse.js';

function generatePassword(length = 10) {
   return crypto.randomBytes(length).toString('base64').slice(0, length);
}
// controllers/evaluatorController.js

export const addPendingEvaluator = async (req, res) => {
   try {
      const { testId } = req.params;
      const { evaluatorEmails } = req.body;

      if (!Array.isArray(evaluatorEmails) || evaluatorEmails.length === 0)
         return res.status(400).json({ msg: "No evaluator emails provided." });

      const test = await Test.findById(testId);
      if (!test) return res.status(404).json({ msg: "Test not found" });

      let invited = [];
      for (let evaluatorEmail of evaluatorEmails) {

         let evaluator = await Evaluator.findOne({ email: evaluatorEmail })

         if (evaluator) {
            const acceptToken = jwt.sign({ evaluatorId: evaluator._id, testId }, process.env.JWT_SECRET, { expiresIn: "7d" })

            const link = `http://localhost:3000/evaluator/accept?testId=${testId}&token=${acceptToken}`;

            await sendEvaluatorAssignmentMail(evaluatorEmail, link, test.title)
            continue;
         }

         // Prevent duplicate invites
         if (test.pendingEvaluators.some(e => e.email === evaluatorEmail)) continue;

         const token = crypto.randomBytes(32).toString('hex');
         test.pendingEvaluators.push({
            email: evaluatorEmail,
            inviteToken: token,
            invitedAt: new Date()
         });

         // Save after each push to avoid race conditions!
         await test.save();

         const link = `http://localhost:3000/evaluator/invite?testId=${testId}&token=${token}`;
         await sendEvaluatorInviteMail(evaluatorEmail, link);

         invited.push({ email: evaluatorEmail, token }); // For debug
      }

      return res.status(200).json({ msg: "Invitations sent", invited });
   } catch (error) {
      console.log("eval err:", error);
      return res.status(500).json({ msg: "Internal error", error: error.message });
   }
};

export const registerFromInvite = async (req, res) => {
   try {
      console.log("first error");
      const { testId, token, name, password } = req.body;
      const test = await Test.findById(testId);
      console.log("first error");
      if (!test) return res.status(404).json({ msg: "Test not found" });

      // DEBUG - print all pending tokens
      // console.log("DEBUG pendingEvaluators:", test.pendingEvaluators.map(e => e.inviteToken));
      // console.log("DEBUG incoming token:", token);
      console.log("first error");
      const pending = test.pendingEvaluators.find(e => e.inviteToken === token);
      console.log("first error");
      if (!pending) return res.status(400).json({ msg: "Invalid or expired invite." });
      console.log("first error");
      let evaluator = await Evaluator.findOne({ email: pending.email });
      if (evaluator) {
         return res.status(409).json({ msg: "Evaluator already registered. Please login." });
      }

      const hashed = await bcrypt.hash(password, 10);
      evaluator = await Evaluator.create({ name, email: pending.email, password: hashed });

      test.evaluators.push(evaluator._id);
      // Remove the pending evaluator after registration
      test.pendingEvaluators = test.pendingEvaluators.filter(
         e => e.inviteToken !== token && e.email !== evaluator.email
      );
      await test.save();

      const jwtToken = jwt.sign(
         { _id: evaluator._id, email: evaluator.email, role: "evaluator" },
         process.env.JWT_SECRET,
         { expiresIn: "7d" }
      );

      res.cookie("evaluator_token", jwtToken, {
         httpOnly: true,
         maxAge: 7 * 24 * 60 * 60 * 1000,
         sameSite: "strict"
      });

      res.json({ evaluator: { _id: evaluator._id, email: evaluator.email, name: evaluator.name }, token: jwtToken });

   } catch (error) {
      console.log("REGISTER ERROR:", error);
      return res.status(500).json({ msg: "Internal error occurred" });
   }
};

// Step 1: Send OTP
export const sendForgotPasswordOtp = async (req, res) => {
   const { email } = req.body;
   const evaluator = await Evaluator.findOne({ email });
   if (!evaluator) return res.status(404).json({ msg: "No evaluator with that email" });

   const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
   evaluator.resetPasswordToken = otp;
   evaluator.resetPasswordExpires = Date.now() + 15 * 60 * 1000;

   await evaluator.save();

   await transporter.sendMail({
      to: email,
      subject: "Reset your Evaluator password",
      text: `Your OTP is: ${otp}`,
   });

   res.json({ msg: "OTP sent to email" });
};

// Step 2: Reset password
export const resetEvaluatorPassword = async (req, res) => {
   const { email, otp, newPassword } = req.body;
   const evaluator = await Evaluator.findOne({
      email,
      resetPasswordToken: otp,
      resetPasswordExpires: { $gt: Date.now() }
   });
   if (!evaluator) return res.status(400).json({ msg: "Invalid or expired OTP" });

   evaluator.password = await bcrypt.hash(newPassword, 10);
   evaluator.resetPasswordToken = undefined;
   evaluator.resetPasswordExpires = undefined;
   await evaluator.save();

   res.json({ msg: "Password updated. Please login." });
};

export async function evaluatorLogin(req, res) {
   const { email, password } = req.body;
   const evaluator = await Evaluator.findOne({ email });
   if (!evaluator) return res.status(401).json({ msg: "Invalid credentials." });

   const match = await bcrypt.compare(password, evaluator.password);
   if (!match) return res.status(401).json({ msg: "Invalid credentials." });

   const jwtToken = jwt.sign(
      { _id: evaluator._id, email: evaluator.email, role: "evaluator" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
   );
   res.cookie("evaluator_token", jwtToken, { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000, sameSite: "strict" });
   res.json({ evaluator: { _id: evaluator._id, email: evaluator.email, name: evaluator.name }, token: jwtToken });
}

export const getEvaluatorTests = async (req, res) => {
   try {
      const { evaluator } = req
      console.log("evaluator:", evaluator);
      const tests = await Test.find({ evaluators: evaluator._id || evaluator._id })
      console.log("evaluator tests:", tests);
      console.log(typeof (evaluator.id))
      return res.status(200).json({ msg: "Tests for evaluator fetched", tests })
   } catch (error) {

      console.log(error)
      return res.status(500).json({ msg: "Invalid entry" })
   }
}

export const getTestAttempts = async (req, res) => {
   try {
      const { testId } = req.params
      const evaluatorId = req.evaluator._id || req.evaluator.id

      if (!testId) return res.status(401).json({ msg: "Invalid test ID" })

      const attemptedTests = await TestAttempt.find({ test: testId }).populate("student").populate("answer.question")

      res.json({ attemptedTests })

   } catch (error) {
      return res.status(500).json({ msg: "Internal error occured" })
   }
}

export const getTestAttempt = async (req, res) => {
   try {
      const { attemptId } = req.params
      if (!attemptId) return res.status(400).json({ msg: "Invalid test attempt Id" })

      const testAttempt = await TestAttempt.findById(attemptId)

      return res.status(200).json({ msg: "Test attempt fetched", attempt: testAttempt })
   } catch (error) {
      return res.status(500).json({ msg: "Internal error occured" })
   }
}

export async function reviewStudentAnswer(req, res) {
   const { testAttemptId, questionId } = req.params;
   const { rating, review } = req.body;
   const evaluatorId = req.evaluator._id;

   const attempt = await TestAttempt.findById(testAttemptId);
   if (!attempt) return res.status(404).json({ msg: "Test attempt not found." });

   const answer = attempt.answers.find(ans => ans.question.equals(questionId));
   if (!answer) return res.status(404).json({ msg: "Answer not found." });

   let reviewObj = answer.reviews.find(r => r.evaluator.equals(evaluatorId));
   if (reviewObj) {
      reviewObj.rating = rating;
      reviewObj.review = review;
   } else {
      answer.reviews.push({ evaluator: evaluatorId, rating, review });
   }
   await attempt.save();
   res.json({ msg: "Review submitted." });
}


export const acceptEvaluatorAssignment = async (req, res) => {

   const { testId, token } = req.query;
   // console.log("DEBUGGGG!!!")
   // console.log(testId)
   // console.log(token)
   let payload;
   try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
      // console.log(payload)
   } catch (e) {
      return res.status(400).json({ msg: "Invalid or expired token" });
   }

   const test = await Test.findById(testId);
   console.log(test)
   if (!test) return res.status(404).json({ msg: "Test not found" });

   if (!test.evaluators.includes(payload.evaluatorId)) {
      test.evaluators.push(payload.evaluatorId);
      await test.save();
   }
   res.json({ msg: "You are now an evaluator for this test" });
};

// Utility function (not Express handler)
export const deleteEvaluatorById = async (evaluatorId) => {

   await Test.updateMany(
      { evaluators: evaluatorId },
      { $pull: { evaluators: evaluatorId } }
   );

   const evaluator = await Evaluator.findById(evaluatorId);
   if (evaluator) {
      await Test.updateMany(
         { "pendingEvaluators.email": evaluator.email },
         { $pull: { pendingEvaluators: { email: evaluator.email } } }
      );
   }

   await Evaluator.findByIdAndDelete(evaluatorId);
}

// Express handler for /me
export const deleteMe = async (req, res) => {
   try {
      const evaluatorId = req.evaluator._id;
      await deleteEvaluatorById(evaluatorId);
      res.clearCookie("evaluator_token");
      res.status(200).json({ msg: "Evaluator deleted" });
   } catch (error) {
      res.status(500).json({ msg: "Internal error occurred", error: error.message });
   }
}

// Express handler for admin (by param)
export const deleteEvaluator = async (req, res) => {
   try {
      const { evaluatorId } = req.params;
      await deleteEvaluatorById(evaluatorId);
      res.status(200).json({ msg: "Evaluator deleted and removed from all tests." });
   } catch (error) {
      res.status(500).json({ msg: "Internal error occurred", error: error.message });
   }
}


export const getVivaResultsByTest = async (req, res) => {
  try {
    const { testId } = req.params;
   //  console.log("getVivaResultsByTest", testId);

    // sirf wahi results jinke _id aur status match kare
   const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    // ✅ sharedLinkId extract karo
    const { sharedLinkId } = test;
    console.log("📌 Shared Link ID:", sharedLinkId);

    const vivaResults = await VivaResult.find({
      testId: sharedLinkId,
      status: "Not Evaluated",
    });

    if (!vivaResults || vivaResults.length === 0) {
      return res.status(404).json({ message: "No viva results found for this test" });
    }

    res.json(vivaResults);
  } catch (err) {
    console.error("❌ Error in getVivaResultsByTest:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getVivaResultsByTestAll = async (req, res) => {
  try {
   // console.log("hello");
    const { testId } = req.params;
    console.log("getVivaResultsByTestAll is called", testId);

    // ✅ Test model fetch karo
    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    // ✅ sharedLinkId extract karo
    const { sharedLinkId } = test;
    console.log("📌 Shared Link ID:", sharedLinkId);

    // sirf wahi results jinke _id aur status match kare
    const vivaResults = await VivaResult.find({ testId: sharedLinkId });
console.log("getVivaResultsByTestAll is called", vivaResults);
    if (!vivaResults || vivaResults.length === 0) {
      return res.status(404).json({ message: "No viva results found for this test" });
    }

    res.json(vivaResults);
  } catch (err) {
    console.error("❌ Error in getVivaResultsByTest:", err);
    res.status(500).json({ error: err.message });
  }
};


// ✅ Submit evaluator feedback
// ✅ Submit evaluator feedback
export const submitFeedback = async (req, res) => {
  try {
    console.log("submit");

    const { candidateId, testId, score, remarks, questionwise_details } = req.body;

    // 🔎 Check if test exists
    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    // ✅ sharedLinkId extract karo
    const { sharedLinkId } = test;
    console.log("📌 Shared Link ID:", sharedLinkId);

    // ✅ New evaluator entry with questionwise details
    const evaluatorEntry = new EvaluatorResponse({
      sharedLinkId,
      candidateId,
      score,
      questionwise_details,
    });

    // Optional: overall remarks agar rakhna chahte ho to model me ek "overallRemarks" add karna padega
    if (remarks) {
      evaluatorEntry.overallRemarks = remarks;
    }

    console.log("submit1");
    await evaluatorEntry.save();
    console.log("submit2");

    // ✅ Step 2: Update VivaResult status
    await VivaResult.findOneAndUpdate(
      { testId: sharedLinkId, candidateId: candidateId },
      { $set: { status: "Evaluated" } },
      { new: true }
    );

    res.json({ message: "Feedback submitted successfully", evaluatorEntry });
  } catch (error) {
    console.error("❌ Error in submitFeedback:", error);
    res.status(500).json({ error: error.message });
  }
};

// to share evaluator scores to prof test details section
export const getEvaluatorResponse = async (req, res) => {
  try {
    const { testId, candidateId } = req.params;
    console.log("getEvaluatorResponse is called", candidateId);

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    // ✅ sharedLinkId extract karo
    const { sharedLinkId } = test;
    console.log("📌 Shared Link ID:", sharedLinkId);

    // sirf wahi results jinke _id aur status match kare
    const evaluatorResponse = await EvaluatorResponse.find({ sharedLinkId: sharedLinkId, candidateId: candidateId });
    console.log("docs received:", evaluatorResponse);
// console.log("getevaluatorResponseByTestAll is called", evaluatorResponse);
    if (!evaluatorResponse || evaluatorResponse.length === 0) {
      console.log("error?");
      return res.status(404).json({ message: "No evaluator response found" });
    }

    res.json(evaluatorResponse);
  } catch (err) {
    console.error("❌ Error in getevaluatorResponse:", err);
    res.status(500).json({ error: err.message });
  }
};

//for students call all viva results
export const getVivaResultsByTestAllforStud = async (req, res) => {
  try {
   console.log("hello");
    const { candidateId } = req.params;
    console.log("getVivaResultsByTestAllforStud is called", candidateId);

    
    const vivaResults = await VivaResult.find({ candidateId: candidateId });

    if (!vivaResults || vivaResults.length === 0) {
      return res.status(404).json({ message: "No viva results found for this test" });
    }

    res.json(vivaResults);
  } catch (err) {
    console.error("❌ Error in getVivaResultsByTestforStud:", err);
    res.status(500).json({ error: err.message });
  }
};