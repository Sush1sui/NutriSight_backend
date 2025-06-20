import { Request, Response } from "express";
import bcrypt from "bcrypt";
import UserAccount from "../models/UserAccount";
import crypto from "crypto";

export const register = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ message: "Email and password required" });
    return;
  }
  const existing = await UserAccount.findOne({ email });
  if (existing) {
    res.status(409).json({ message: "Email already registered" });
    return;
  }
  const hashed = await bcrypt.hash(password, 10);
  const otp = crypto.randomInt(100000, 999999).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  const user = await UserAccount.create({
    email,
    password: hashed,
    otp,
    otpExpires,
    isVerified: false,
  });
  // TODO: Send OTP to email (implement email sending)
  res.json({ message: "OTP sent to email", userId: user._id });
};

export const verifyOtp = async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  const user = await UserAccount.findOne({ email });
  if (
    !user ||
    user.otp !== otp ||
    !user.otpExpires ||
    user.otpExpires < new Date()
  ) {
    res.status(400).json({ message: "Invalid or expired OTP" });
    return;
  }
  user.isVerified = true;
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();
  res.json({ message: "Account verified" });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await UserAccount.findOne({ email });
  if (!user || !user.isVerified) {
    res.status(401).json({ message: "Invalid credentials or not verified" });
    return;
  }
  if (!user.password) {
    res.status(401).json({ message: "No password set for this account" });
    return;
  }
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }
  res.json({ message: "Login successful", user });
};
