import crypto from "crypto";
import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

// In-memory reset token store (replace with DB collection in production)
const resetTokens = new Map(); // token -> { userId, expires }

function signToken(user) {
  return jwt.sign(
    { id: user._id, company: user.company, role: user.role },
    process.env.JWT_SECRET || "dev-secret-change-me",
    { expiresIn: "12h" }
  );
}

// ─── LOGIN ───────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email: String(email).toLowerCase() }).select("+password");
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: "Invalid email or password" });

    if (!user.active)
      return res.status(403).json({ message: "Account is disabled. Contact your administrator." });

    res.json({
      token: signToken(user),
      user: { id: user._id, name: user.name, email: user.email, role: user.role, company: user.company }
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed", detail: err.message });
  }
});

// ─── FORGOT PASSWORD ─────────────────────────────────────────────────────────
// Generates a reset token. In production, email this token to the user.
// For now it is returned in the response (dev/admin use only).
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email: String(email).toLowerCase() });
    // Always return 200 to avoid leaking which emails exist
    if (!user) return res.json({ message: "If that email exists, a reset link has been sent." });

    // Generate secure random token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = Date.now() + 1000 * 60 * 30; // 30 minutes
    resetTokens.set(token, { userId: user._id.toString(), expires });

    // TODO: send email with reset link in production
    // e.g. await sendMail(user.email, `https://yourapp.com/reset-password?token=${token}`)

    console.log(`[DEV] Password reset token for ${email}: ${token}`);

    res.json({
      message: "If that email exists, a reset link has been sent.",
      // ⚠️  Remove 'devToken' in production — for local dev only
      devToken: process.env.NODE_ENV !== "production" ? token : undefined
    });
  } catch (err) {
    res.status(500).json({ message: "Request failed", detail: err.message });
  }
});

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password)
      return res.status(400).json({ message: "Token and new password are required" });

    if (password.length < 8)
      return res.status(400).json({ message: "Password must be at least 8 characters" });

    const entry = resetTokens.get(token);
    if (!entry || Date.now() > entry.expires) {
      resetTokens.delete(token);
      return res.status(400).json({ message: "Reset token is invalid or has expired" });
    }

    const user = await User.findById(entry.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = password; // pre('save') hook will hash it
    await user.save();
    resetTokens.delete(token); // invalidate token after use

    res.json({ message: "Password reset successfully. You can now log in." });
  } catch (err) {
    res.status(500).json({ message: "Reset failed", detail: err.message });
  }
});

// ─── CHANGE PASSWORD (authenticated) ─────────────────────────────────────────
import { requireAuth } from "../middleware/auth.js";

router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: "Current and new password are required" });

    if (newPassword.length < 8)
      return res.status(400).json({ message: "New password must be at least 8 characters" });

    const user = await User.findById(req.user._id).select("+password");
    if (!(await user.comparePassword(currentPassword)))
      return res.status(401).json({ message: "Current password is incorrect" });

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ message: "Change failed", detail: err.message });
  }
});

export default router;