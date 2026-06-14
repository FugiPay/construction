import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    employeeCode: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    nrc: String,
    phone: String,
    email: String,
    position: String,
    department: String,
    employmentType: { type: String, enum: ["Permanent", "Contract", "Casual"], default: "Permanent" },
    salary: { type: Number, default: 0 },
    dateHired: Date,
    status: { type: String, enum: ["Active", "Inactive", "Terminated"], default: "Active" },
    documents: [{ name: String, url: String }]
  },
  { timestamps: true }
);

employeeSchema.index({ company: 1, employeeCode: 1 }, { unique: true });

export default mongoose.model("Employee", employeeSchema);
