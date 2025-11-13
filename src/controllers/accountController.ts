import { Request, Response } from "express";
import UserAccount, { IUserAccount } from "../models/UserAccount";
import ScanResult from "../models/ScanResult";
import MealEntry from "../models/MealEntry";
import LoggedWeight from "../models/LoggedWeight";
import FoodModel from "../models/Foods";
import { v2 as cloudinary } from "cloudinary";
import { getDateString } from "../utils/getDateString";
import {
  buildDietHistoryResponse,
  populateUserWithDynamicData,
} from "../utils/populateUserData";
import { hasAllergen } from "../utils/allergenMapping";

const ALLOWED_FIELDS = [
  "gender",
  "birthDate",
  "height",
  "weight",
  "targetWeight",
  "bmi",
  "allergens",
  "medicalConditions",
  "name",
  "firstName",
  "lastName",
  "dailyRecommendation",
  "dietType",
  "activityLevel",
  "weightGoal",
  "heightFeet",
  "heightInches",
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

    // If loggedWeights array is provided, upsert each entry into LoggedWeight
    const loggedWeightsPayload = req.body.loggedWeights;
    if (Array.isArray(loggedWeightsPayload)) {
      for (const weightEntry of loggedWeightsPayload) {
        if (
          weightEntry &&
          (weightEntry.value || weightEntry.value === 0) &&
          weightEntry.date
        ) {
          const dateStr = getDateString(weightEntry.date);
          await LoggedWeight.findOneAndUpdate(
            { userId: uid, date: dateStr },
            { value: weightEntry.value, date: dateStr },
            { upsert: true, new: true }
          );
        }
      }
    }

    // Return the updated user with dynamic data (diet history, loggedWeights, etc.)
    const updatedUser = await UserAccount.findById(uid).lean();
    const populatedUser = await populateUserWithDynamicData(updatedUser);

    res.status(200).json({ message: "Profile updated", data: populatedUser });
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

    // Process each meal type and save to normalized tables
    const mealTypes: Array<"breakfast" | "lunch" | "dinner" | "otherMealTime"> =
      ["breakfast", "lunch", "dinner", "otherMealTime"];

    for (const mealType of mealTypes) {
      const meals = incomingMeals[mealType];

      for (const meal of meals) {
        // Find or create ScanResult
        let scanResult = await ScanResult.findOne({
          $or: [
            { sourceId: meal.id, source: meal.source },
            { name: meal.name || meal.foodName, brand: meal.brand },
          ],
        });

        if (!scanResult) {
          scanResult = await ScanResult.create({
            name: meal.name,
            foodName: meal.foodName,
            brand: meal.brand,
            servingSize: meal.servingSize,
            ingredients: meal.ingredients || [],
            nutritionData: meal.nutritionData || [],
            source: meal.source,
            sourceId: meal.id,
          });
        }

        // Create MealEntry
        await MealEntry.create({
          userId: uid,
          scanResultId: scanResult._id,
          date: incomingDateStr,
          mealType,
          quantity: meal.quantity || 1,
          triggeredAllergens: meal.triggeredAllergens || [],
        });
      }
    }

    // Fetch the reconstructed diet history for response (maintains API compatibility)
    const dietHistory = await buildDietHistoryResponse(uid);

    res.status(200).json({
      message: "Diet history updated",
      dietHistory,
    });
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

    // Fetch from normalized tables
    const dietHistory = await buildDietHistoryResponse(uid);
    const entry = dietHistory.find((record) => record.date === targetDateStr);

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

    // Accept "other" alias from frontend and normalize to "otherMealTime"
    const normalizedMealTime =
      mealTime === "other" ? "otherMealTime" : String(mealTime);

    const ALLOWED_MEALS = new Set([
      "breakfast",
      "lunch",
      "dinner",
      "otherMealTime",
    ]);
    if (!ALLOWED_MEALS.has(normalizedMealTime)) {
      res.status(400).json({ error: "Invalid mealTime parameter" });
      return;
    }

    // Delete from MealEntry (id is the MealEntry._id)
    const deleteResult = await MealEntry.findByIdAndDelete(id);

    if (!deleteResult) {
      res.status(404).json({ error: "Meal entry not found" });
      return;
    }

    // Fetch updated user data with all diet history
    const updatedUser = await UserAccount.findById(uid).lean();

    // populate user with dynamic data
    const populatedUser = await populateUserWithDynamicData(updatedUser);

    res.status(200).json({
      message: "Diet history entry deleted",
      user: populatedUser,
    });
  } catch (error) {
    console.error("Error deleting diet history:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Logged Weights Controllers
export const addLoggedWeight = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const { value, date } = req.body;
    if (!value || !date) {
      res.status(400).json({ error: "Value and date are required" });
      return;
    }

    const uid = (req.user as { _id: string })._id;
    const dateStr = getDateString(date);

    // Upsert: update if exists for this date, create if not
    await LoggedWeight.findOneAndUpdate(
      { userId: uid, date: dateStr },
      { value, date: dateStr },
      { upsert: true, new: true }
    );

    const user = await UserAccount.findById(uid);
    const populatedUser = await populateUserWithDynamicData(user);

    res.status(200).json({
      message: "Weight logged successfully",
      data: populatedUser,
    });
  } catch (error) {
    console.error("Error logging weight:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getLoggedWeights = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const uid = (req.user as { _id: string })._id;
    const weights = await LoggedWeight.find({ userId: uid }).sort({ date: -1 });

    res.status(200).json({
      message: "Logged weights retrieved",
      loggedWeights: weights.map((w) => ({ value: w.value, date: w.date })),
    });
  } catch (error) {
    console.error("Error getting logged weights:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteLoggedWeight = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const { date } = req.body;
    if (!date) {
      res.status(400).json({ error: "Date is required" });
      return;
    }

    const uid = (req.user as { _id: string })._id;
    const dateStr = getDateString(date);

    await LoggedWeight.findOneAndDelete({ userId: uid, date: dateStr });

    // Get remaining weights
    const allWeights = await LoggedWeight.find({ userId: uid }).sort({
      date: -1,
    });

    res.status(200).json({
      message: "Weight deleted successfully",
      loggedWeights: allWeights.map((w) => ({ value: w.value, date: w.date })),
    });
  } catch (error) {
    console.error("Error deleting logged weight:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getRecommendationForTheDay = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const uid = (req.user as { _id: string })._id;
    const user = await UserAccount.findById(uid);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const recommendations = [];

    // Get user's daily macro recommendations and allergens
    const dailyRecommendation = user.dailyRecommendation || {
      calories: 0,
      carbs: 0,
      protein: 0,
      fat: 0,
    };
    const userAllergens = user.allergens || [];

    // Only search if user has daily recommendations set
    if (dailyRecommendation.calories > 0) {
      // Query foods from database
      const foods = await FoodModel.find({}).lean();

      // Filter and score foods based on macro matching
      for (const food of foods) {
        // Check for allergen conflicts in common_ingredients using comprehensive mapping
        if (hasAllergen(food.common_ingredients, userAllergens)) {
          continue; // Skip foods with allergens
        }

        // Extract macros from nutrition array
        const getNutritionValue = (name: string): number => {
          const nutrient = food.nutrition.find(
            (n) => n.name.toLowerCase() === name.toLowerCase()
          );
          return nutrient ? nutrient.value : 0;
        };

        const foodCalories = getNutritionValue("calories");
        const foodCarbs = getNutritionValue("carbohydrates");
        const foodProtein = getNutritionValue("protein");
        const foodFat = getNutritionValue("fat");

        // Calculate a simple match score based on how close the food is to daily recommendations
        // We'll look for foods that are a reasonable portion of daily intake (10-40%)
        const targetCaloriesPerMeal = dailyRecommendation.calories / 3; // Rough estimate for one meal
        const targetCarbsPerMeal = dailyRecommendation.carbs / 3;
        const targetProteinPerMeal = dailyRecommendation.protein / 3;
        const targetFatPerMeal = dailyRecommendation.fat / 3;

        // Calculate percentage match (within 50-150% of target is good)
        const isGoodMatch =
          foodCalories >= targetCaloriesPerMeal * 0.5 &&
          foodCalories <= targetCaloriesPerMeal * 1.5 &&
          foodCarbs >= targetCarbsPerMeal * 0.5 &&
          foodCarbs <= targetCarbsPerMeal * 1.5 &&
          foodProtein >= targetProteinPerMeal * 0.5 &&
          foodProtein <= targetProteinPerMeal * 1.5 &&
          foodFat >= targetFatPerMeal * 0.5 &&
          foodFat <= targetFatPerMeal * 1.5;

        if (isGoodMatch) {
          recommendations.push({
            name: food.name,
            servingSize: food.serving_size,
            nutrition: food.nutrition,
            source: food.source,
            ingredients: food.common_ingredients,
          });
        }
      }
    }

    res.status(200).json({
      message: "Daily recommendations retrieved",
      recommendations,
    });
  } catch (error) {
    console.error("Error getting daily recommendations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
