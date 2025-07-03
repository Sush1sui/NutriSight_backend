import { Request, Response } from "express";
import bcrypt from "bcrypt";
import UserAccount from "../models/UserAccount";
import crypto from "crypto";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // Add your email to .env
    pass: process.env.EMAIL_PASS, // Add your password to .env
  },
});

export const register = async (req: Request, res: Response) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    res.status(400).json({ message: "Email, name, and password required" });
    return;
  }
  const existing = await UserAccount.findOne({ email });
  if (existing && existing.isVerified) {
    res.status(409).json({ message: "Email already registered" });
    return;
  }
  const hashed = await bcrypt.hash(password, 10);
  const otp = crypto.randomInt(100000, 999999).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  // Use updateOne with upsert to handle both new and unverified users
  await UserAccount.updateOne(
    { email },
    {
      $set: {
        password: hashed,
        name,
        otp,
        otpExpires,
        isVerified: false,
      },
    },
    { upsert: true }
  );

  const user = await UserAccount.findOne({ email });
  if (!user) {
    res.status(500).json({ message: "Failed to create or find user" });
    return;
  }

  // Send OTP to email
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your OTP for Verification",
    text: `Your OTP is: ${otp}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: "OTP sent to email", userId: user._id });
    return;
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ message: "Error sending OTP email" });
  }
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
  req.logIn(user, (err) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Session login failed after verification" });
    }
    return res.json({ message: "Account verified and user logged in", user });
  });
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
  req.logIn(user, (err) => {
    if (err) {
      return res.status(500).json({ message: "Session login failed" });
    }
    return res.json({ message: "Login successful", user });
  });
};

export const logout = (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: "Error during logout" });
    }
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Error destroying session" });
      }
      res.clearCookie("connect.sid"); // Default session cookie name
      return res.json({ message: "Logout successful" });
    });
    return;
  });
};

export const checkSession = (req: Request, res: Response) => {
  if (req.isAuthenticated() && req.user) {
    const sessionUser = req.user as any; // User object from Passport
    res.status(200).json({
      user: {
        id: sessionUser.id,
        displayName: sessionUser.name || sessionUser.email,
        email: sessionUser.email,
      },
    });
  } else {
    // No active session
    res.status(401).json({ message: "Not authenticated" });
  }
};
