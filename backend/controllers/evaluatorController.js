import crypto from 'crypto';
import bcrypt from 'bcrypt';

import Test from "../models/Test.js";
import Examiner from "../models/Examiner.js";
import transporter from "../utils/mailer.js";
import { sendEvaluatorInviteMail } from '../utils/evaluatorMailTemplate.js';
import Evaluator from '../models/Evaluator.js';
import TestAttempt from '../models/TestAttempt.js';

function generatePassword(length = 10) {
   return crypto.randomBytes(length).toString('base64').slice(0, length);
}
// controllers/evaluatorController.js

export const addPendingEvaluator = async (req, res) => {
   try {
      const { testId } = req.params;
      const { evaluatorEmails } = req.body; // should be an array from frontend

      if (!Array.isArray(evaluatorEmails) || evaluatorEmails.length === 0)
         return res.status(400).json({ msg: "No evaluator emails provided." });

      const test = await Test.findById(testId);
      if (!test) return res.status(404).json({ msg: "Test not found" });

      let invited = [];

      for (let evaluatorEmail of evaluatorEmails) {
         const token = crypto.randomBytes(32).toString('hex');

         // Prevent duplicate pending invites
         if (test.pendingEvaluators.some(e => e.email === evaluatorEmail)) continue;

         test.pendingEvaluators.push({
            email: evaluatorEmail,
            inviteToken: token,
            invitedAt: new Date()
         });

         const link = `http://${process.env.FRONTEND_URL}/evaluator/invite?testId=${testId}&token=${token}`;
         await sendEvaluatorInviteMail(evaluatorEmail, link);
         invited.push(evaluatorEmail);
      }

      await test.save();

      return res.status(200).json({ msg: "Invitations sent", invited });
   } catch (error) {
      return res.status(500).json({ msg: "Internal error", error: error.message });
   }
};


export const registerFromInvite = async (req, res) => {
   try {
      const { testId, token, name, password } = req.body
      const test = await Test.findById(testId);

      if (!test) {
         return res.status(404).json({ msg: "Test not found" })
      }

      const pending = test.pendingEvaluators.find(e => e.inviteToken === token)

      if (!pending) return res.status(400).json({ msg: "Invalid or expired invite." });

      let evaluator = await Evaluator.findOne({ email: pending.email });
      if (evaluator) {
         return res.status(409).json({ msg: "Evaluator already registered. Please login." });
      }

      const hashed = await bcrypt.hash(password, 10);
      evaluator = await Evaluator.create({ name, email: pending.email, password: hashed });

      test.evaluators.push(evaluator._id);
      test.pendingEvaluators = test.pendingEvaluators.filter(e => e.inviteToken !== token);
      await test.save();

      const jwtToken = jwt.sign(
         { id: evaluator._id, email: evaluator.email, role: "evaluator" },
         process.env.JWT_SECRET,
         { expiresIn: "7d" }
      )

      res.cookie("evaluator_token",
         jwtToken,
         {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60,
            sameSite: "strict"
         }
      )

      res.json({ evaluator: { id: evaluator._id, email: evaluator.email, name: evaluator.name }, token: jwtToken });

   } catch (error) {
      return res.status(500).json({
         msg: "Internal error occured"
      })
   }
}


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
      const { evaluatorId } = req.evaluator._id
      const tests = await Test.find({ evaluators: evaluatorId })
      return res.status(200).json({ msg: "Tests for evaluator fetched", tests })
   } catch (error) {
      return res.status(500).json({ msg: "Invalid entry" })
   }
}

export const getTestAttempts = async (req, res) => {
   try {
      const { testId } = req.params
      const { evaluatorId } = req.evaluator._id

      if (!testId) return res.status(401).json({ msg: "Invalid test ID" })

      const attemptedTests = await TestAttempt.find({ test: testId }).populate("student").populate("answer.question")

      res.json({ attemptedTests })

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

// export const sendEvaluationLink = async (req, res) => {
//    try {
//       const { testId } = req.params;
//       const test = await Test.findById(testId);
//       if (!test) return res.status(404).json({ msg: "Test not found" });

//       const examiner = await Examiner.findById(test.examiner).populate("user");
//       if (!examiner || !examiner.user) return res.status(404).json({ msg: "Examiner not found" });

//       const mailHTML = getEvaluationMailHTML({
//          recipientName: examiner.user.name,
//          testTitle: test.title,
//          evaluationLink: `https://${process.env.FRONTEND_URL}/evaluate/${testId}`,
//          additionalText: "These are the student responses to be evaluated",
//          footerText: "Please complete the evaluation by the specified deadline."
//       });

//       await transporter.sendMail({
//          from: process.env.USER_GMAIL,
//          to: examiner.user.email,
//          subject: "Test Answers Ready for Evaluation",
//          html: mailHTML,
//       });

//       res.status(200).json({ msg: "Evaluation link sent to examiner." });
//    } catch (err) {
//       console.error(err);
//       res.status(500).json({ msg: "Internal error" });
//    }
// };
