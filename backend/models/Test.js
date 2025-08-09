import mongoose from 'mongoose';

const forbiddenStatuses = ['active', 'published', 'finished', 'archived'];

const TestSchema = new mongoose.Schema({
   title: { type: String, required: true },
   examiner: { type: mongoose.Schema.Types.ObjectId, ref: 'Examiner', required: true },
   description: { type: String, required: true },
   evaluators: [{ type: mongoose.Schema.Types.ObjectId, ref: "Evaluator" }],
   department: { type: String },
   sharedLinkId: { type: String, unique: true },
   problems: [{
      questionText: { type: String, required: true },
      modelAnswer: { type: String, required: true }
   }],
   students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
   pendingEvaluators: [{
      email: { type: String },
      inviteToken: { type: String },
      invitedAt: { type: Date }
   }],
   duration: { type: Number, required: true },
   status: {
      type: String,
      enum: ['draft', 'published', 'active', 'finished', 'archived'],
      default: 'draft'
   },
   studentCount: { type: Number, default: 0 },
   createdAt: { type: Date, default: Date.now },
   start_time: { type: Date, required: true },
   end_time: { type: Date }
}, { timestamps: true });

// Virtual for calculated end time
TestSchema.virtual('calculatedEndTime').get(function () {
   if (this.start_time && this.duration) {
      return new Date(this.start_time.getTime() + this.duration * 60000);
   }
   return null;
});

// Prevent updates for forbidden statuses (query updates)
TestSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], async function (next) {
   const docToUpdate = await this.model.findOne(this.getQuery());
   if (docToUpdate && forbiddenStatuses.includes(docToUpdate.status)) {
      return next(new Error(`Cannot modify a ${docToUpdate.status} test.`));
   }
   next();
});

// Prevent updates for forbidden statuses (direct save)
TestSchema.pre('save', function (next) {
   if (!this.isNew && forbiddenStatuses.includes(this.status) && this.isModified()) {
      return next(new Error(`Cannot modify a ${this.status} test.`));
   }
   next();
});

export default mongoose.model('Test', TestSchema);
