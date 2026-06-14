import mongoose from "mongoose";

const timesheetSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    date: { type: Date, required: true },
    normalHours: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    doubleOvertimeHours: { type: Number, default: 0 },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" }
  },
  { timestamps: true }
);

export default mongoose.model("Timesheet", timesheetSchema);
