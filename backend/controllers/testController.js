import csv from "csv-parser";
import { Readable } from "stream";

import Test from "../models/Test.js";
import Question from "../models/Question.js";
import TestAttempt from "../models/TestAttempt.js";
import { v4 as uuidv4 } from "uuid";
import Student from "../models/Student.js";
import User from "../models/User.js";
import Examiner from "../models/Examiner.js";

export const createTest = async (req, res) => {
   try {
      const { title, description, start_time, duration, department } = req.body;
      const examinerId = req.user._id;

      const examiner = await Examiner.findOne({ user: examinerId });
      if (!examiner) return res.status(401).json({ msg: "Unauthorized" });

      const sharedLinkId = uuidv4();

      const test = await Test.create({
         title,
         examiner: examiner._id,
         description,
         start_time,
         duration,
         department,
         sharedLinkId,
         status: 'draft',
      });

      await test.save();
      res.status(201).json({ msg: "Test created successfully", test });

   } catch (error) {
      console.error("Error creating test:", error);
      res.status(500).json({ msg: "Internal server error" });
   }
}


export const addProblemsFromCsv = async (req, res) => {
   try {
      const { testId } = req.params;
      const { file } = req;
      const { user } = req;

      const examiner = await Examiner.findOne({ user: user._id });
      if (!examiner) return res.status(401).json({ msg: "Unauthorized" });

      if (!file) {
         return res.status(400).json({ msg: "No CSV file uploaded" });
      }
      const test = await Test.findById(testId);

      if (!test) { return res.status(404).json({ msg: "Test not found" }); }

      if (test.status !== 'draft') {
         return res.status(400).json({ msg: "Cannot remove problems from an active or finished test" });
      }

      const problems = [];
      const bufferStream = new Readable();
      bufferStream.push(file.buffer);
      bufferStream.push(null);

      bufferStream
         .pipe(csv())
         .on('data', (data) => {
            if (data.questionText && data.modelAnswer) {
               problems.push({
                  questionText: data.questionText,
                  modelAnswer: data.modelAnswer
               });
            }
         })
         .on('end', async () => {
            try {
               test.problems = problems
               await test.save();
               return res.status(200).json({ msg: "Problems added successfully", problems });
            } catch (error) {
               return res.status(500).json({ msg: "Error processing CSV data" });
            }
         })

   } catch (error) {
      console.error("Error adding problems:", error);
      res.status(500).json({ msg: "Internal server error" });
   }
}


export const removeProblem = async (req, res) => {
   try {
      const { testId, problemId } = req.params;
      const { user } = req;

      const examiner = await Examiner.findOne({ user: user._id });

      if (!examiner) return res.status(401).json({ msg: "Unauthorized" });

      const test = await Test.findById(testId);

      if (!test) return res.status(404).json({ msg: "Test not found" });

      if (test.examiner.toString() !== examiner._id.toString())
         return res.status(401).json({ msg: "Examiner Unauthorized" });

      if (test.status !== 'draft') {
         return res.status(400).json({ msg: "Cannot remove problems from an active or finished test" });
      }

      const problemIndex = test.problems.findIndex(p => p._id.toString() === problemId);

      if (problemIndex === -1) {
         return res.status(404).json({ msg: "Problem not found in the test" });
      }
      test.problems.splice(problemIndex, 1);
      await test.save();

   } catch (error) {
      console.log("Error removing problem:", error);
      res.status(500).json({ msg: "Internal server error" });
   }
}

export const addSingleProblem = async (req, res) => {
   try {
      const { testId } = req.params;
      const { questionText, modelAnswer } = req.body;

      const { user } = req;

      const examiner = await Examiner.findOne({ user: user._id });

      if (!examiner) return res.status(401).json({ msg: "Unauthorized" });

      const test = await Test.findById(testId);

      if (!test) return res.status(404).json({ msg: "Test not found" });

      if (test.examiner.toString() !== examiner._id.toString())
         return res.status(401).json({ msg: "Examiner Unauthorized" });

      if (test.status !== 'draft') {
         return res.status(400).json({ msg: "Cannot add problems to an active or finished test" });
      }

      const newProblem = {
         questionText,
         modelAnswer
      };

      test.problems.push(newProblem);
      await test.save();

      return res.status(200).json({ msg: "Problem added successfully", problem: newProblem });

   } catch (error) {
      console.error("Error adding single problem:", error);
      res.status(500).json({ msg: "Internal server error" });
   }
}

export const activateTest = async (req, res) => {
   try {
      const { testId } = req.params;
      const { user } = req;
      const examiner = await Examiner.findOne({ user: user._id });
      if (!examiner) return res.status(401).json({ msg: "Unauthorized" });

      const test = await Test.findById(testId);
      if (!test) return res.status(404).json({ msg: "Test not found" });

      if (test.examiner.toString() !== examiner._id.toString())
         return res.status(401).json({ msg: "Examiner Unauthorized" });

      if (test.status !== 'draft') {
         return res.status(400).json({ msg: "Test is not in draft status" });
      }

      if (test.problems.length === 0) {
         return res.status(400).json({ msg: "Cannot activate test with no problems" });
      }

      test.status = 'active';
      await test.save();

      res.status(200).json({ msg: "Test activated successfully", test });

   } catch (error) {
      console.error("Error activating test:", error);
      res.status(500).json({ msg: "Internal server error" });
   }
}


export const addSingleStudent = async (req, res) => {
   try {
      const { testId } = req.params;
      const { name, scholarId, email } = req.body;
      const { user: examinerUser } = req;

      const examiner = await Examiner.findOne({ user: examinerUser._id });
      if (!examiner) return res.status(401).json({ msg: "Unauthorized" });
      const test = await Test.findById(testId);
      if (!test) return res.status(404).json({ msg: "Test not found" });
      if (test.examiner.toString() !== examiner._id.toString())
         return res.status(401).json({ msg: "Examiner Unauthorized" });

      if (test.status !== 'draft') {
         return res.status(400).json({ msg: "Cannot add students to an active or finished test" });
      }


      const existingStudent = await Student.findOne({ scholarId });
      if (existingStudent) {
         if (test.students.includes(existingStudent._id)) {
            return res.status(400).json({ msg: "Student already added to this test" });
         }

         test.students.push(existingStudent._id);
         await test.save();
         return res.status(200).json({ msg: "Student added to Test", student: existingStudent });
      }

      const tempPassword = uuidv4().slice(0, 8); // Generate a temporary password
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      const newUser = await User.create({
         name,
         email,
         username: scholarId,
         role: 'student',
         password: hashedPassword
      })

      const newStudent = await Student.create({
         user: newUser._id,
         scholarId,
         department: test.department || 'General', // Default to 'General' if not specified
      })

      test.students.push(newStudent._id);
      await test.save();

      console.log(`Student ${name} added with temporary password: ${tempPassword}`);

      return res.status(200).json({ msg: "New student created and added to Test", student: newStudent, tempPassword });

   } catch (error) {
      console.log("Error adding single student:", error);
      res.status(500).json({ msg: "Internal server error" });
   }
}



export const addStudentsFromCsv = async (req, res) => {
   try {
      const { testId } = req.params;
      const { file } = req;
      const { user: examinerUser } = req;

      const examiner = await Examiner.findOne({ user: examinerUser._id });
      if (!examiner) return res.status(401).json({ msg: "Unauthorized: Examiner not found" });

      const test = await Test.findById(testId);
      if (!test) return res.status(404).json({ msg: "Test not found" });

      if (test.examiner.toString() !== examiner._id.toString()) {
         return res.status(401).json({ msg: "Unauthorized: Not the test owner" });
      }

      if (test.status !== 'draft') {
         return res.status(400).json({ msg: "Cannot add students to an active or finished test" });
      }

      if (!file) return res.status(400).json({ msg: "No CSV file uploaded" });

      const addedStudents = [];
      const bufferStream = new Readable();
      bufferStream.push(file.buffer);
      bufferStream.push(null);

      bufferStream
         .pipe(csv())
         .on('data', async (data) => {
            // Assuming CSV headers are 'name', 'scholarId', 'email', 'department'
            const { name, scholarId, email, department } = data;
            if (!name || !scholarId || !email) {
               console.warn("Skipping row due to missing data:", data);
               return;
            }

            try {
               const existingStudent = await Student.findOne({ scholarId });
               if (existingStudent) {
                  // If student is not already on the test, add them.
                  if (!test.students.includes(existingStudent._id)) {
                     test.students.push(existingStudent._id);
                     addedStudents.push(existingStudent);
                  }
               } else {
                  // Create new User and Student
                  const tempPassword = uuidv4().substring(0, 8);
                  const hashedPassword = await bcrypt.hash(tempPassword, 10);

                  const newUser = await User.create({
                     name,
                     email,
                     username: scholarId,
                     password: hashedPassword,
                     role: 'student',
                  });

                  const newStudent = await Student.create({
                     user: newUser._id,
                     scholarId,
                     department
                  });

                  test.students.push(newStudent._id);
                  addedStudents.push(newStudent);
               }
            } catch (dbError) {
               console.error("Database error processing CSV row:", dbError);
            }
         })
         .on('end', async () => {
            try {
               await test.save();
               res.status(200).json({ msg: "Students processed successfully", addedStudents });
            } catch (saveError) {
               console.error("Error saving test after CSV import:", saveError);
               res.status(500).json({ msg: "Error saving student data" });
            }
         });

   } catch (error) {
      console.error("Error adding students from CSV:", error);
      res.status(500).json({ msg: "Internal server error" });
   }
}

// export const createTest = async (req, res) => {
//    try {
//       // console.log("req body:",req.body);
//       const { title, start_time, end_time, department } = req.body;
//       let { scholarIds } = req.body;

//       const sharedLinkId = uuidv4();

//       if (typeof scholarIds === "string") scholarIds = [scholarIds]
//       if (!Array.isArray(scholarIds) || !scholarIds.length)
//          return res.status(400).json({ msg: "Provide at least one student Id" });


//       const students = await Student.find({ scholarId: { $in: scholarIds } }).populate('user');

//       const added = students
//          .filter(st => st.user && st.user.role === "student")
//          .map(st => st._id);


//       const test = await Test.create({
//          title,
//          examiner: examiner._id,
//          department,
//          start_time,
//          end_time,
//          sharedLinkId,
//          students: added
//       });


//       res.status(200).json({ msg: "Test created", test });

//    } catch (err) {
//       console.error("Error creating test:", err);
//       res.status(500).json({ msg: "An error occurred while creating the test" });
//    }
// };


// export const addQuestion = async (req, res) => {
//    try {
//       const { testId } = req.params;
//       const { question } = req.body;

//       const test = await Test.findById(testId);
//       if (!test) return res.status(404).json({ msg: "Test not found" });

//       const q = await Question.create({ testId, questionText: question });

//       test.questions.push(q._id);

//       await test.save();

//       res.status(200).json({ msg: "Question added successfully" });
//    } catch (err) {
//       console.error(err);
//       res.status(500).json({ msg: "Internal error occurred" });
//    }
// };

// export const addQuestions = async (req, res) => {
//    try {
//       const { testId } = req.params;
//       const { questions } = req.body;

//       if (!testId || !Array.isArray(questions))
//          return res.status(400).json({ msg: "Invalid testId or questions" });

//       const test = await Test.findById(testId);
//       if (!test) return res.status(404).json({ msg: "Test not found" });

//       const docs = await Promise.all(
//          questions.map(qt => Question.create({ testId, questionText: qt }))
//       );

//       test.questions.push(...docs.map(d => d._id));

//       await test.save();

//       res.status(200).json({ msg: "Questions added successfully" });
//    } catch (err) {
//       console.error("Add questions error:", err);
//       res.status(500).json({ msg: "Server error while adding questions" });
//    }
// };
