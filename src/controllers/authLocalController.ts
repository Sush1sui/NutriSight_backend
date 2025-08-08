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

export const sendOtp = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ message: "Email is required" });
    return;
  }

  // Check if user exists
  const existing = await UserAccount.findOne({ email });
  if (existing && existing.isVerified) {
    res.status(409).json({ message: "Email already registered" });
    return;
  }

  const otp = crypto.randomInt(1000, 9999).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  // Use updateOne with upsert to handle both new and unverified users
  await UserAccount.updateOne(
    { email },
    {
      $set: {
        // birthdate: new Date("2002-06-24"),
        // height: 5.2, // Example height in feet
        // weight: 57, // Example weight in kg
        // targetWeight: 55, // Example target weight in kg
        // bmi: 22.5, // Example BMI
        // allergens: ["nuts", "gluten"], // Example allergens
        // medicalConditions: ["high blood pressure"], // Example medical conditions
        // dietHistory: [],
        otp,
        otpExpires,
        isVerified: false,
      },
    },
    { upsert: true }
  );

  // Send OTP to email
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your OTP for Verification",
    text: `Your OTP is: ${otp}`,
  };

  await transporter.sendMail(mailOptions);
};

export const register = async (req: Request, res: Response) => {
  const { email, firstName, lastName, password } = req.body;
  if (!email || !firstName || !lastName || !password) {
    res
      .status(400)
      .json({ message: "Email, first name, last name, and password required" });
    return;
  }
  const existing = await UserAccount.findOne({ email });
  if (existing && existing.isVerified) {
    res.status(409).json({ message: "Email already registered" });
    return;
  }
  const hashed = await bcrypt.hash(password, 10);
  const otp = crypto.randomInt(1000, 9999).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  // Use updateOne with upsert to handle both new and unverified users
  await UserAccount.updateOne(
    { email },
    {
      $set: {
        password: hashed,
        firstName,
        lastName,
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
  res.json({ message: "OTP verified successfully", success: true });
  return;
};

export const onboardingSubmit = async (req: Request, res: Response) => {
  const { name, allergens, gender, age, height, weight, email } = req.body;

  if (!name || !allergens || !gender || !age || !height || !weight) {
    res.status(400).json({ message: "All fields are required" });
    return;
  }

  // console.log("Onboarding data:", {
  //   name,
  //   allergens,
  //   gender,
  //   age,
  //   height,
  //   weight,
  //   email,
  // });

  // Update user profile with onboarding data
  const user = await UserAccount.findOne({ email });
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  user.name = name;
  user.allergens = allergens;
  user.gender = gender;
  user.age = age;
  user.height = height;
  user.weight = weight;
  user.bmi = weight / (height * 0.3048) ** 2; // Calculate BMI

  await user.save();
  // login user
  res.json({ message: "Onboarding completed successfully", success: true });
  return;
};

export const agreement = async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ message: "Email is required" });
    return;
  }
  const user = await UserAccount.findOne({ email });
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  req.logIn(user, (err) => {
    if (err) {
      return res.status(500).json({ message: "Session login failed" });
    }

    const userObj = user.toObject ? user.toObject() : user;
    delete userObj.password; // Remove password from response

    return res.json({
      message: "Agreement completed successfully",
      user: userObj,
    });
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

  const userObj = user.toObject ? user.toObject() : user;
  delete userObj.password; // Remove password from response

  req.logIn(user, (err) => {
    if (err) {
      return res.status(500).json({ message: "Session login failed" });
    }
    return res.json({
      message: "Login successful",
      user: userObj,
    });
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

    const userObj = sessionUser.toObject ? sessionUser.toObject() : sessionUser;
    delete userObj.password; // Remove password from response

    res.status(200).json({
      user: userObj,
    });
  } else {
    // No active session
    res.status(401).json({ message: "Not authenticated" });
  }
};
