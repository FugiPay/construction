import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    registrationNumber: String,
    domain: String,
    address: String,
    phone: String
  },
  { timestamps: true }
);

export default mongoose.model("Company", companySchema);
