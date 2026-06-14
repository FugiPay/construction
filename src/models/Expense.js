import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    expenseCategory: {
      type: String,
      enum: ["Material", "Fuel", "Equipment Hire", "Labour", "Subcontract", "Maintenance", "Transport"],
      required: true
    },
    description: String,
    amount: { type: Number, required: true, min: 0 },
    expenseDate: { type: Date, required: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

export default mongoose.model("Expense", expenseSchema);
