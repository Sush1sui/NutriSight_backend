import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import UserAccount from "../models/UserAccount";

// This is the CLIENT_ID of the web application from Google Cloud Console
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const verifyGoogleToken = async (req: Request, res: Response) => {
  const { idToken } = req.body;

  console.log("Received ID Token:", idToken);

  if (!idToken) {
    res.status(400).json({ message: "ID token not provided." });
    return;
  }

  try {
    // Verify the ID token with Google.
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID, // Specify the CLIENT_ID of the app that accesses the backend
    });

    const payload = ticket.getPayload();

    if (!payload) {
      res.status(401).json({ message: "Invalid ID token." });
      return;
    }

    const { sub: id, email, name, given_name, family_name } = payload;

    // Upsert logic: Find user by Google ID, or by email, or create new.
    let user = await UserAccount.findOne({ gmailId: id });

    if (!user && email) {
      const existingUser = await UserAccount.findOne({ email });
      if (existingUser) {
        existingUser.gmailId = id;
        existingUser.isVerified = true; // Google verifies the email
        existingUser.name = name || undefined;
        existingUser.firstName = given_name || undefined;
        existingUser.lastName = family_name || undefined;
        existingUser.email = email;
        // existingUser.birthdate = new Date("2002-06-24");
        // existingUser.height = 5.2; // Example height in feet
        // existingUser.weight = 57; // Example weight in kg
        // existingUser.targetWeight = 55; // Example target weight in kg
        // existingUser.bmi = 22.5; // Example BMI
        // existingUser.allergens = ["nuts", "gluten"]; // Example allergens
        // existingUser.medicalConditions = ["high blood pressure"]; // Example medical conditions
        // existingUser.dietHistory = []; // Initialize diet history
        user = await existingUser.save();
      }

      if (existingUser) {
        req.logIn(existingUser, (err) => {
          if (err) {
            console.error("Session login error after token verification:", err);
            res.status(500).json({ message: "Could not create session." });
            return;
          }

          // On successful login, send back user data
          res.status(200).json({
            user: existingUser,
          });
          return;
        });
        return;
      } else {
        res.status(401).json({ message: "User not found for login." });
        return;
      }
    }

    if (!user) {
      user = await UserAccount.create({
        gmailId: id,
        email,
        name,
        firstName: given_name || undefined,
        lastName: family_name || undefined,
        // birthdate: new Date("2002-06-24"), // Example birthdate
        // height: 5.2, // Example height in feet
        // weight: 57, // Example weight in kg
        // targetWeight: 55, // Example target weight in kg
        // bmi: 22.5, // Example BMI
        // allergens: ["nuts", "gluten"], // Example allergens
        // medicalConditions: ["high blood pressure"], // Example medical conditions
        // dietHistory: [], // Initialize diet history
        isVerified: true, // Email is verified by Google
      });
    }

    // Manually log in the user to establish a session cookie
    // req.logIn(user, (err) => {
    //   if (err) {
    //     console.error("Session login error after token verification:", err);
    //     res.status(500).json({ message: "Could not create session." });
    //     return;
    //   }

    //   // On successful login, send back user data
    //   res.status(200).json({
    //     user: {
    //       id: user.id,
    //       name: user.name,
    //       email: user.email,
    //       firstName: user.firstName,
    //       lastName: user.lastName,
    //     },
    //   });
    //   return;
    // });
    res.status(200).json({
      message: "User authenticated successfully",
      email: user.email,
      success: true,
    });
    return;
  } catch (error) {
    console.error("Google token verification error:", error);
    res.status(401).json({ message: "Authentication failed. Invalid token." });
  }
};
