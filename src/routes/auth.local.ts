import express from "express";
import { register, verifyOtp, login } from "../controllers/authLocalController";

const router = express.Router();

// Register with email/password (send OTP)
router.post("/register", register);

// Verify OTP
router.post("/verify-otp", verifyOtp);

// Login with email/password
router.post("/login", login);

export default router;
