import { Request, Response } from "express";
import UserAccount, { DietHistory, IUserAccount } from "../models/UserAccount";
import { v2 as cloudinary } from "cloudinary";

const ALLOWED_FIELDS = [
  "gender",
  "age",
  "height",
  "weight",
  "targetWeight",
  "bmi",
  "allergens",
  "medicalConditions",
  "dietHistory",
  "name",
  "firstName",
  "lastName",
];

export const changeProfilePicture = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const profileLink = req.file.path;
    const profilePublicId = req.file.filename || (req.file as any).public_id; // multer-storage-cloudinary sets public_id as filename

    if (!profileLink || !profilePublicId) {
      res.status(400).json({ error: "Failed to upload image" });
      return;
    }

    // Get user and delete previous image if exists
    const uid = (req.user as { _id: string })._id;
    const user = await UserAccount.findById(uid);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Delete previous image from Cloudinary
    if (user.profilePublicId) {
      await cloudinary.uploader.destroy(user.profilePublicId);
    }

    // Update user in DB
    user.profileLink = profileLink;
    user.profilePublicId = profilePublicId;
    await user.save();

    res.status(200).json({
      message: "Profile picture updated successfully",
      profileLink: user.profileLink,
    });
  } catch (error) {
    console.error("Error changing profile picture:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateAccount = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const updates: Partial<IUserAccount> = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in req.body) {
        updates[field as keyof IUserAccount] = req.body[field];
      }
    }

    const uid = (req.user as { _id: string })._id;
    const user = await UserAccount.findByIdAndUpdate(
      uid,
      { $set: updates },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.status(200).json({ message: "Profile updated", data: user });
  } catch (error) {
    console.error("Error updating account:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateDietHistory = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const { dietHistoryPayload } = req.body;

    if (!dietHistoryPayload) {
      res.status(400).json({ error: "Invalid diet history format" });
      return;
    }

    const uid = (req.user as { _id: string })._id;

    const user = await UserAccount.findById(uid);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // find diet history date
    if (user.dietHistory) {
      const existingDietHistory = user.dietHistory.find((entry) => {
        const entryDate = (dietHistoryPayload as DietHistory).date;
        return (
          entryDate.getFullYear() === entry.date.getFullYear() &&
          entryDate.getMonth() === entry.date.getMonth() &&
          entryDate.getDate() === entry.date.getDate()
        );
      });

      // increment those existing from dietHistory.nutritionalData
      // like protein exists like protein: 4
      // then payload have protein: 5
      // increment the existing key from the payload so the result will be protein: 9
      if (existingDietHistory) {
        const incoming = (dietHistoryPayload as DietHistory).nutritionalData[0]; // assuming payload is always an array with one object
        const existingArray = existingDietHistory.nutritionalData;

        if (existingArray.length > 0) {
          // Increment the last entry in the array
          const lastEntry = existingArray[existingArray.length - 1];
          for (const key of Object.keys(incoming)) {
            if (lastEntry[key] !== undefined) {
              lastEntry[key] += incoming[key];
            } else {
              lastEntry[key] = incoming[key];
            }
          }
        } else {
          // If no entry exists, push the incoming one
          existingArray.push(incoming);
        }
      } else {
        // If no diet history for this date, add a new entry
        user.dietHistory.push(dietHistoryPayload as DietHistory);
      }
    } else {
      // If no diet history exists at all, create the array with the new entry
      user.dietHistory = [dietHistoryPayload as DietHistory];
    }

    await user.save();
    res
      .status(200)
      .json({ message: "Diet history updated", dietHistory: user.dietHistory });
  } catch (error) {
    console.error("Error updating diet history:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
