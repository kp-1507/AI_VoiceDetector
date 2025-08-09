import User from "../models/User.js";
import Student from "../models/Student.js";
import Test from "../models/Test.js";

export const getAllStudentEmails = async (req, res) => {
   try {
      const students = await User.find({ role: "student" }).select("email");

      res.json({ emails: students.map(s => s.email) });
   } catch {
      res.status(500).json({ msg: "Failed to fetch student emails" });
   }
};

export const getAllProfEmails = async (req, res) => {
   try {
      const profs = await User.find({ role: "examiner" }).select("email -_id");
      res.json({ emails: profs.map(s => s.email) });
   } catch {
      res.status(500).json({ msg: "Failed to fetch prof emails and usernames" });
   }
};

export const getAllStudentScholarId = async (req, res) => {
   try {
      const students = await Student.find({}, "scholarId"); // 👈 only get scholarId
      const scholarIds = students.map(s => s.scholarId);
      res.status(200).json({ scholarIds });
   } catch (err) {
      console.error("Server error:", err); // 👈 check this in terminal
      res.status(500).json({ msg: "Server error" });
   }
};

