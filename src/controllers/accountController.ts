import { Request, Response } from "express";
import UserAccount, { IUserAccount } from "../models/UserAccount";
import { v2 as cloudinary } from "cloudinary";
import { getDateString } from "../utils/getDateString";

const ALLOWED_FIELDS = [
  "gender",
  "birthDate",
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
  "loggedWeights",
  "dailyRecommendation",
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

    // logs payload
    console.log("Account update payload:", req.body);

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

    // Normalize incoming meal arrays (expect ScanResultType objects)
    const incomingMeals = {
      breakfast: Array.isArray(dietHistoryPayload.breakfast)
        ? dietHistoryPayload.breakfast
        : [],
      lunch: Array.isArray(dietHistoryPayload.lunch)
        ? dietHistoryPayload.lunch
        : [],
      dinner: Array.isArray(dietHistoryPayload.dinner)
        ? dietHistoryPayload.dinner
        : [],
      otherMealTime: Array.isArray(dietHistoryPayload.otherMealTime)
        ? dietHistoryPayload.otherMealTime
        : [],
    };

    const incomingDateStr = getDateString(dietHistoryPayload.date);

    // find existing entry for the same date (compare normalized date string)
    const existingIndex = (user.dietHistory || []).findIndex((entry) => {
      return getDateString(entry.date) === incomingDateStr;
    });

    if (user.dietHistory && existingIndex >= 0) {
      // append incoming ScanResultType items to existing meal arrays
      const existing = user.dietHistory[existingIndex];
      existing.breakfast = [
        ...(existing.breakfast || []),
        ...incomingMeals.breakfast,
      ];
      existing.lunch = [...(existing.lunch || []), ...incomingMeals.lunch];
      existing.dinner = [...(existing.dinner || []), ...incomingMeals.dinner];
      existing.otherMealTime = [
        ...(existing.otherMealTime || []),
        ...incomingMeals.otherMealTime,
      ];
      // replace entry
      user.dietHistory[existingIndex] = existing;
    } else {
      // push a new date entry with the incoming meal arrays
      user.dietHistory = [
        ...(user.dietHistory || []),
        {
          date: dietHistoryPayload.date,
          breakfast: incomingMeals.breakfast,
          lunch: incomingMeals.lunch,
          dinner: incomingMeals.dinner,
          otherMealTime: incomingMeals.otherMealTime,
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

export const getDietHistoryByDate = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const { date } = req.body;
    if (!date) {
      res.status(400).json({ error: "Date parameter is required" });
      return;
    }

    const uid = (req.user as { _id: string })._id;
    const user = await UserAccount.findById(uid);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const targetDateStr = getDateString(date);
    const entry = (user.dietHistory || []).find(
      (record) => getDateString(record.date) === targetDateStr
    );
    if (!entry) {
      res
        .status(200)
        .json({ message: "No entry for this date", dietHistory: null });
      return;
    }
    res.status(200).json({ message: "Diet history found", dietHistory: entry });
  } catch (error) {
    console.error("Error retrieving diet history:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteDietHistoryByDate = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }
    const { date, mealTime, id } = req.body;
    if (!date || !mealTime || !id) {
      res
        .status(400)
        .json({ error: "Date, mealTime, and id parameters are required" });
      return;
    }
    const uid = (req.user as { _id: string })._id;
    const user = await UserAccount.findById(uid);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const targetDateStr = getDateString(date);
    const entryIndex = (user.dietHistory || []).findIndex(
      (record) => getDateString(record.date) === targetDateStr
    );
    if (entryIndex < 0) {
      res
        .status(200)
        .json({ message: "No entry for this date", dietHistory: null });
      return;
    }
    const entry = user.dietHistory![entryIndex];
    if (
      !entry[mealTime as keyof typeof entry] ||
      !Array.isArray(entry[mealTime as keyof typeof entry])
    ) {
      res.status(400).json({ error: "Invalid mealTime parameter" });
      return;
    }
    // filter out the item with the given id
    if (mealTime === "breakfast") {
      entry.breakfast = entry.breakfast.filter((item) => item.id !== id);
    } else if (mealTime === "lunch") {
      entry.lunch = entry.lunch.filter((item) => item.id !== id);
    } else if (mealTime === "dinner") {
      entry.dinner = entry.dinner.filter((item) => item.id !== id);
    } else if (mealTime === "otherMealTime") {
      entry.otherMealTime = entry.otherMealTime.filter(
        (item) => item.id !== id
      );
    }

    // if all meal arrays are empty, remove the entire date entry
    if (
      entry.breakfast.length === 0 &&
      entry.lunch.length === 0 &&
      entry.dinner.length === 0 &&
      entry.otherMealTime.length === 0
    ) {
      user.dietHistory!.splice(entryIndex, 1);
    }

    await user.save();
    res.status(200).json({
      message: "Diet history entry deleted",
      user, // so that frontend can update local state
    });
  } catch (error) {
    console.error("Error deleting diet history:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
