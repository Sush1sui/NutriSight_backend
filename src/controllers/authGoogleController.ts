import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import UserAccount from "../models/UserAccount";

// This is the CLIENT_ID of the web application from Google Cloud Console
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const verifyGoogleToken = async (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token) {
    res.status(400).json({ message: "ID token not provided." });
    return;
  }

  try {
    // Verify the ID token with Google.
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID, // Specify the CLIENT_ID of the app that accesses the backend
    });

    const payload = ticket.getPayload();

    if (!payload) {
      res.status(401).json({ message: "Invalid ID token." });
      return;
    }

    const { sub: id, email, name } = payload;

    // Upsert logic: Find user by Google ID, or by email, or create new.
    let user = await UserAccount.findOne({ gmailId: id });

    if (!user && email) {
      const existingUser = await UserAccount.findOne({ email });
      if (existingUser) {
        existingUser.gmailId = id;
        existingUser.isVerified = true; // Google verifies the email
        user = await existingUser.save();
      }
    }

    if (!user) {
      user = await UserAccount.create({
        gmailId: id,
        email,
        name,
        isVerified: true, // Email is verified by Google
      });
    }

    // Manually log in the user to establish a session cookie
    req.logIn(user, (err) => {
      if (err) {
        console.error("Session login error after token verification:", err);
        res.status(500).json({ message: "Could not create session." });
        return;
      }

      // On successful login, send back user data
      res.status(200).json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      });
      return;
    });
  } catch (error) {
    console.error("Google token verification error:", error);
    res.status(401).json({ message: "Authentication failed. Invalid token." });
  }
};
