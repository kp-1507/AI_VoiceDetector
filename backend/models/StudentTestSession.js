import mongoose from 'mongoose';

const StudentTestSessionSchema = new mongoose.Schema({
   test: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
   student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

   status: {
      type: String,
      enum: ['in-progress', 'submitted', 'graded'],
      default: 'in-progress'
   },

   // This is the key change: we link to the problem in the Test document
   studentResponses: [{
      problemIndex: { type: Number, required: true }, // Index in the Test.problems array
      studentAnswer: { type: String }, // The student's free-form answer
      isGraded: { type: Boolean, default: false },
      score: { type: Number, min: 0, max: 100 },
      graderFeedback: { type: String },
      grader: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
   }],

   // ... other fields like aiAnalysis, totalScore, overallFeedback ...

}, { timestamps: true });

export default mongoose.model('StudentTestSession', StudentTestSessionSchema);