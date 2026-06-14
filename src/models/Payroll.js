import mongoose from "mongoose";

const payrollSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    month: { type: String, required: true },
    year: { type: Number, required: true },
    basicSalary: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ["Paid", "Unpaid"], default: "Unpaid" }
  },
  { timestamps: true }
);

payrollSchema.pre("validate", function calculateNetPay(next) {
  this.netPay = this.basicSalary + this.allowances - this.deductions;
  next();
});

export default mongoose.model("Payroll", payrollSchema);
