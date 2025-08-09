import User from "../models/User.js";
import Test from "../models/Test.js";
import Student from "../models/Student.js";
import Examiner from "../models/Examiner.js";

export const inviteStudents = async (req, res) => {
   try {

      const { testId } = req.params;
      let { scholarIds } = req.body;
      const { user } = req;

      if (typeof scholarIds === "string") scholarIds = [scholarIds];
      if (!Array.isArray(scholarIds) || !scholarIds.length)
         return res.status(400).json({ msg: "Provide at least one student Id" });

      const test = await Test.findById(testId);
      if (!test) return res.status(404).json({ msg: "Test not found" });

      const examiner = await Examiner.findOne({ user: user._id });
      if (!examiner) return res.status(401).json({ msg: "Unauthorized" });
      if (test.examiner.toString() !== examiner._id.toString())
         return res.status(401).json({ msg: "Unauthorized" });

      // Get all Student docs for given scholarIds
      const students = await Student.find({ scholarId: { $in: scholarIds } }).populate('user');
      const foundIds = students.map(s => s.scholarId);
      const notFoundIds = scholarIds.filter(id => !foundIds.includes(id));
      let added = [];

      // Add unique students to test
      for (const student of students) {
         if (!test.students.includes(student._id)) {
            test.students.push(student._id);
            added.push(student._id);
         }
      }
      await test.save();

      let msg;
      if (added.length === 0) {
         msg = "No valid students were added.";
      } else if (notFoundIds.length) {
         msg = `Some students added. Not found: ${notFoundIds.join(", ")}`;
      } else {
         msg = "All students added to Test.";
      }
      // console.log(added)

      res.status(200).json({
         msg,
         addedStudents: added,
         notFoundIds
      });
   } catch (err) {
      console.error(err);
      res.status(500).json({ msg: "Internal error occurred" });
   }
};


export const removeStudent = async (req, res) => {
   try {
      const { testId } = req.params;
      const { studentId } = req.body;
      const { user } = req;

      const examiner = await Examiner.findOne({ user: user._id });
      if (!examiner) return res.status(401).json({ msg: "Unauthorized" });

      const test = await Test.findById(testId);
      if (!test) return res.status(404).json({ msg: "Test not found" });
      if (test.examiner.toString() !== examiner._id.toString())
         return res.status(401).json({ msg: "Examiner Unauthorized" });

      const wasPresent = test.students.some(id => id.toString() === studentId);
      if (!wasPresent) {
         return res.status(404).json({ msg: "Student was not part of the test" });
      }

      test.students = test.students.filter(id => id.toString() !== studentId);
      await test.save();

      res.status(200).json({ msg: "Student removed from Test" });
   } catch (err) {
      console.error(err);
      res.status(500).json({ msg: "Internal error occurred" });
   }
};


export const getTestStudents = async (req, res) => {
   try {
      const { testId } = req.params;
      const test = await Test.findById(testId).populate({
         path: "students",
         populate: { path: "user", select: "email name" }
      });
      if (!test) return res.status(404).json({ msg: "Test not found" });
      res.json({
         students: test.students.map(s => ({
            _id: s._id,
            email: s.user?.email || "unknown",
            name: s.user?.name || "unknown",
         }))
      });
   } catch (err) {
      res.status(500).json({ msg: "Failed to fetch test students" });
   }
};