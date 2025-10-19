import express from "express";
import {
  register,
  verifyOtp,
  login,
  logout,
  checkSession,
  sendOtp,
  onboardingSubmit,
  agreement,
  changePassword,
  userHavePassword,
} from "../controllers/authLocalController";

const router = express.Router();

// Register with email/password (send OTP)
router.post("/register", register);

// Send OTP to email
router.post("/send-otp", sendOtp);

// Verify OTP
router.post("/verify-otp", verifyOtp);

// Onboarding submission
router.post("/onboarding", onboardingSubmit);

// Agreement
router.post("/agreement", agreement);

// Login with email/password
router.post("/login", login);

// Logout
router.post("/logout", logout);

// Check session status
router.get("/session", checkSession);

// Change password
router.post("/change-password", changePassword)

// Verify if password exists
router.get("/has-password", userHavePassword)

export default router;
