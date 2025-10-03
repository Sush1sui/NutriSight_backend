import { Request, Response } from "express";
import bcrypt from "bcrypt";
import UserAccount from "../models/UserAccount";
import crypto from "crypto";
import nodemailer from "nodemailer";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15 minutes

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // Add your email to .env
    pass: process.env.EMAIL_PASS, // Add your password to .env
  },
});

export const sendOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ message: "Email is required" });
      return;
    }

    // Check if user exists and already verified
    const existing = await UserAccount.findOne({ email });
    if (existing && existing.isVerified) {
      res.status(409).json({ message: "Email already registered" });
      return;
    }

    const otp = crypto.randomInt(1000, 9999).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // Upsert OTP and expiry
    await UserAccount.updateOne(
      { email },
      {
        $set: {
          otp,
          otpExpires,
          isVerified: false,
        },
      },
      { upsert: true }
    );

    // Fetch the (new or updated) user to return ID
    const user = await UserAccount.findOne({ email });

    // Send OTP to email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP for Verification",
      text: `Your OTP is: ${otp}`,
    };

    await transporter.sendMail(mailOptions);

    // Respond to client so request doesn't hang
    res.status(200).json({ message: "OTP sent to email", userId: user?._id });
    return;
  } catch (error) {
    console.error("Error in sendOtp:", error);
    res.status(500).json({ message: "Error sending OTP email" });
    return;
  }
};

export const register = async (req: Request, res: Response) => {
  const { email, firstName, lastName, password } = req.body;
  if (!email || !firstName || !lastName || !password) {
    res
      .status(400)
      .json({ message: "Email, first name, last name, and password required" });
    return;
  }

  // Enforce minimum password length
  // if (password.length < 8) {
  //   res
  //     .status(400)
  //     .json({ message: "Password must be at least 8 characters long" });
  //   return;
  // }

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
  res.json({
    message: "OTP verified successfully",
    success: true,
    email: user.email,
  });
  return;
};

export const onboardingSubmit = async (req: Request, res: Response) => {
  const {
    name,
    allergens,
    gender,
    birthDate,
    heightFeet,
    heightInches,
    weight,
    email,
    weightGoal,
    targetWeight,
    activityLevel,
    loggedWeightPayload,
  } = req.body;

  if (
    !name ||
    !allergens ||
    !gender ||
    !birthDate ||
    !heightFeet ||
    !heightInches ||
    !weight ||
    !weightGoal ||
    targetWeight === null ||
    targetWeight === undefined ||
    !email ||
    !activityLevel ||
    !loggedWeightPayload
  ) {
    res.status(400).json({ message: "All fields are required" });
    return;
  }

  // Update user profile with onboarding data
  const user = await UserAccount.findOne({ email });
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  // Convert height to meters
  const feet_x_12 = heightFeet * 12;
  const initHeight = feet_x_12 + heightInches;
  const heightMeters = initHeight * 0.0254;
  const heightMetersPowerOf2 = heightMeters ** 2;

  // convert height to cm and calculate desired weight
  const heightFeetToInches = heightFeet * 12;
  const totalHeightInches = heightFeetToInches + heightInches;

  const heightInchesToCm = totalHeightInches * 2.54;
  const heightInchesToCmLess100 = heightInchesToCm - 100;
  const heightInchesToCmLess100MultipledBy0_1 = 0.1 * heightInchesToCmLess100;

  const desiredWeight =
    heightInchesToCmLess100 - heightInchesToCmLess100MultipledBy0_1;

  console.log("Desired Weight (kg):", desiredWeight);

  let targetCalories =
    activityLevel === "sedentary"
      ? desiredWeight * 30
      : activityLevel === "active"
      ? desiredWeight * 35
      : null;

  console.log("Target Calories before goal adjustment:", targetCalories);

  if (!targetCalories) {
    res.status(400).json({ message: "Invalid activity level" });
    return;
  }

  if (weightGoal === "lose") {
    targetCalories -= 300; // Reduce by 300 for weight loss
  } else if (weightGoal === "gain") {
    targetCalories += 300; // Increase by 300 for weight gain
  }

  console.log("Target Calories after goal adjustment:", targetCalories);

  const calories15Percent = 0.15 * targetCalories;
  const calories25Percent = 0.25 * targetCalories;
  const calories60Percent = 0.6 * targetCalories;

  // Macronutrient distribution (15% fat, 25% protein, 60% carbs)
  // All converted to grams
  const targetFat = calories15Percent / 9;
  const targetProtein = calories25Percent / 4;
  const targetCarbs = calories60Percent / 4;

  console.log("Macronutrient Targets (grams):");
  console.log("Protein:", targetProtein);
  console.log("Carbs:", targetCarbs);
  console.log("Fat:", targetFat);

  user.name = name;
  user.allergens = allergens;
  user.gender = gender;
  user.birthDate = birthDate;
  user.heightFeet = heightFeet;
  user.heightInches = heightInches;
  user.weight = weight;
  user.bmi = weight / heightMetersPowerOf2; // Calculate BMI
  user.weightGoal = weightGoal;
  user.targetWeight = targetWeight;
  user.activityLevel = activityLevel;
  user.dailyRecommendation = {
    calories: Math.round(targetCalories),
    protein: Math.round(targetProtein),
    carbs: Math.round(targetCarbs),
    fat: Math.round(targetFat),
  };
  user.loggedWeights = loggedWeightPayload;

  await user.save();
  // login user
  res.json({
    message: "Onboarding completed successfully",
    success: true,
    email: user.email,
    dailyRecommendation: {
      calories: Math.round(targetCalories),
      protein: Math.round(targetProtein),
      carbs: Math.round(targetCarbs),
      fat: Math.round(targetFat),
    },
  });
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

  // Check if account is locked
  if (user.lockUntil && user.lockUntil > new Date()) {
    const minutes = Math.ceil(
      (user.lockUntil.getTime() - new Date().getTime()) / 60000
    );
    res
      .status(403)
      .json({ message: `Account locked. Try again in ${minutes} minute(s).` });
    return;
  }

  if (!user.password) {
    res.status(401).json({ message: "No password set for this account" });
    return;
  }
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    // Increment login attempts
    user.loginAttempts = (user.loginAttempts || 0) + 1;

    // Lock account if max attempts reached
    if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_TIME);
      await user.save();
      res.status(403).json({
        message: `Account locked due to too many failed attempts. Try again in 15 minutes.`,
      });
      return;
    }

    await user.save();
    res.status(401).json({
      message: `Invalid credentials. Attempt ${user.loginAttempts} of ${MAX_LOGIN_ATTEMPTS}.`,
    });
    return;
  }

  // Reset login attempts on successful login
  user.loginAttempts = 0;
  user.lockUntil = null;

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
