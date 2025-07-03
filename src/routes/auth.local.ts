import express from "express";
import {
  register,
  verifyOtp,
  login,
  logout,
  checkSession,
  sendOtp,
} from "../controllers/authLocalController";

const router = express.Router();

// Register with email/password (send OTP)
router.post("/register", register);

// Send OTP to email
router.post("/send-otp", sendOtp);

// Verify OTP
router.post("/verify-otp", verifyOtp);

// Login with email/password
router.post("/login", login);

// Logout
router.post("/logout", logout);

// Check session status
router.get("/session", checkSession);

export default router;
