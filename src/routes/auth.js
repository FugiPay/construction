import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user._id, company: user.company, role: user.role },
    process.env.JWT_SECRET || "dev-secret-change-me",
    { expiresIn: "12h" }
  );
}

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email || "").toLowerCase() }).select("+password");
  if (!user || !(await user.comparePassword(password || ""))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  res.json({
    token: signToken(user),
    user: { id: user._id, name: user.name, email: user.email, role: user.role, company: user.company }
  });
});

export default router;
