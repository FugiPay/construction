import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    assignedFrom: Date,
    assignedTo: Date,
    hourlyRate: { type: Number, default: 0 }
  },
  { _id: true }
);

const projectSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    projectCode: { type: String, required: true },
    projectName: { type: String, required: true },
    clientName: { type: String, required: true },
    startDate: Date,
    endDate: Date,
    budget: { type: Number, default: 0 },
    status: { type: String, enum: ["Ongoing", "Completed"], default: "Ongoing" },
    projectManager: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    employees: [assignmentSchema]
  },
  { timestamps: true }
);

projectSchema.index({ company: 1, projectCode: 1 }, { unique: true });

export default mongoose.model("Project", projectSchema);
