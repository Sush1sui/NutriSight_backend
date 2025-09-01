import { Request, Response } from "express";
import UserAccount, { IUserAccount } from "../models/UserAccount";
import { v2 as cloudinary } from "cloudinary";
import { flattenNutritionalData } from "../utils/flattenNutritionalData";

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

    // Flatten the incoming nutritionalData array
    const flattenedNutritionalData = flattenNutritionalData(
      dietHistoryPayload.nutritionalData
    );

    // find diet history date
    if (user.dietHistory) {
      const existingDietHistory = user.dietHistory.find((entry) => {
        const entryDate = new Date(dietHistoryPayload.date);
        return (
          entryDate.getFullYear() === entry.date.getFullYear() &&
          entryDate.getMonth() === entry.date.getMonth() &&
          entryDate.getDate() === entry.date.getDate()
        );
      });

      if (existingDietHistory) {
        const existingArray = existingDietHistory.nutritionalData;

        if (existingArray.length > 0) {
          const lastEntry = Object.assign({}, ...existingArray);

          // Increment or add each nutrient
          for (const key of Object.keys(flattenedNutritionalData)) {
            if (lastEntry[key] !== undefined) {
              lastEntry[key] += flattenedNutritionalData[key];
            } else {
              lastEntry[key] = flattenedNutritionalData[key];
            }
          }
          existingDietHistory.nutritionalData = [lastEntry];
        } else {
          existingDietHistory.nutritionalData.push(flattenedNutritionalData);
        }
      } else {
        user.dietHistory.push({
          date: dietHistoryPayload.date,
          nutritionalData: [flattenedNutritionalData],
          breakfast: dietHistoryPayload.breakfast,
          lunch: dietHistoryPayload.lunch,
          dinner: dietHistoryPayload.dinner,
          otherMealTime: dietHistoryPayload.otherMealTime,
        });
      }
    } else {
      user.dietHistory = [
        {
          date: dietHistoryPayload.date,
          nutritionalData: [flattenedNutritionalData],
          breakfast: dietHistoryPayload.breakfast,
          lunch: dietHistoryPayload.lunch,
          dinner: dietHistoryPayload.dinner,
          otherMealTime: dietHistoryPayload.otherMealTime,
        },
      ];
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
