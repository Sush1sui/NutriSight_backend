import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import UserAccount from "../models/UserAccount";
import { v2 as cloudinary } from "cloudinary";

// This is the CLIENT_ID of the web application from Google Cloud Console
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const verifyGoogleToken = async (req: Request, res: Response) => {
  const { idToken } = req.body;

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
      console.error("Invalid ID token payload");
      res.status(401).json({ message: "Invalid ID token." });
      return;
    }

    const { sub: id, email, name, given_name, family_name, picture } = payload;

    let user = await UserAccount.findOne({ gmailId: id });

    if (user && !user.isVerified && user.email === email) {
      const existingUser = await UserAccount.findOne({ email });
      if (existingUser) {
        existingUser.gmailId = id;
        existingUser.isVerified = true; // Google verifies the email
        existingUser.name = name || undefined;
        existingUser.firstName = given_name || undefined;
        existingUser.lastName = family_name || undefined;
        existingUser.email = email;

        // if google profile picture exists, upload to cloudinary and save link
        if (picture && typeof picture === "string") {
          try {
            if (existingUser.profilePublicId) {
              try {
                await cloudinary.uploader.destroy(existingUser.profilePublicId);
              } catch (e) {
                console.warn("Cloudinary destroy failed (non-fatal):", e);
              }
            }

            const uploadRes = await cloudinary.uploader.upload(picture, {
              folder: "user_profiles",
              public_id: `profile_${user._id}_${Date.now()}`,
              overwrite: true,
              resource_type: "image",
              transformation: [{ width: 500, height: 500, crop: "limit" }],
            });

            if (uploadRes && uploadRes.secure_url) {
              existingUser.profileLink = uploadRes.secure_url || uploadRes.url;
              existingUser.profilePublicId = uploadRes.public_id;
            }
          } catch (error) {
            console.warn(
              "Cloudinary upload failed during Google update (non-fatal):",
              error
            );
          }
        }

        user = await existingUser.save();

        res.status(200).json({
          message: "User authenticated successfully",
          email: user.email,
          success: true,
        });
      } else {
        console.error("User not found for login.");
        res.status(401).json({ message: "User not found for login." });
      }
      return;
    } else if (!user) {
      user = await UserAccount.create({
        gmailId: id,
        email,
        name,
        firstName: given_name || undefined,
        lastName: family_name || undefined,
        isVerified: false,
      });

      // if google profile picture exists, upload to cloudinary and save link
      if (picture && typeof picture === "string") {
        try {
          const uploadRes = await cloudinary.uploader.upload(picture, {
            folder: "user_profiles",
            public_id: `profile_${user._id}_${Date.now()}`,
            overwrite: true,
            resource_type: "image",
            transformation: [{ width: 500, height: 500, crop: "limit" }],
          });

          if (uploadRes && uploadRes.secure_url) {
            user.profileLink = uploadRes.secure_url || uploadRes.url;
            user.profilePublicId = uploadRes.public_id;
          }
        } catch (error) {
          console.warn(
            "Cloudinary upload failed during Google update (non-fatal):",
            error
          );
        }
      }

      await user.save();

      res.status(200).json({
        message: "User authenticated successfully",
        email: user.email,
        success: true,
      });
      return;
    }

    // Manually log in the user to establish a session cookie
    req.logIn(user, (err) => {
      if (err) {
        console.error("Session login error after token verification:", err);
        res.status(500).json({ message: "Could not create session." });
        return;
      }

      const userObj = user.toObject ? user.toObject() : user;
      delete userObj.password; // Remove password from response

      // On successful login, send back user data
      res.status(200).json({
        user: userObj,
      });
      return;
    });
  } catch (error) {
    console.error("Google token verification error:", error);
    res.status(401).json({ message: "Authentication failed. Invalid token." });
  }
};
