import bcrypt from "bcryptjs";
import mongoose from "mongoose";

export const ROLES = [
  "SUPER_ADMIN",
  "HR_MANAGER",
  "PROJECT_MANAGER",
  "ACCOUNTS_OFFICER",
  "DATA_CLERK",
  "SITE_SUPERVISOR",
  "EMPLOYEE"
];

const userSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model("User", userSchema);
