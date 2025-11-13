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

    // Optional query parameters for macro preferences
    const { highProtein, highCarbs, highFat, highCal } = req.query;
    const macroPreference = {
      highProtein: highProtein === "true",
      highCarbs: highCarbs === "true",
      highFat: highFat === "true",
      highCal: highCal === "true",
    };

    const recommendations = {
      breakfast: [] as string[],
      lunch: [] as string[],
      dinner: [] as string[],
      snacks: [] as string[],
    };

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
      // Calculate target macros per meal based on frontend distribution
      const mealTargets = {
        breakfast: {
          calories: dailyRecommendation.calories * 0.25,
          carbs: dailyRecommendation.carbs * 0.25,
          protein: dailyRecommendation.protein * 0.25,
          fat: dailyRecommendation.fat * 0.25,
        },
        lunch: {
          calories: dailyRecommendation.calories * 0.35,
          carbs: dailyRecommendation.carbs * 0.35,
          protein: dailyRecommendation.protein * 0.35,
          fat: dailyRecommendation.fat * 0.35,
        },
        dinner: {
          calories: dailyRecommendation.calories * 0.3,
          carbs: dailyRecommendation.carbs * 0.3,
          protein: dailyRecommendation.protein * 0.3,
          fat: dailyRecommendation.fat * 0.3,
        },
        snacks: {
          calories: dailyRecommendation.calories * 0.1,
          carbs: dailyRecommendation.carbs * 0.1,
          protein: dailyRecommendation.protein * 0.1,
          fat: dailyRecommendation.fat * 0.1,
        },
      };

      // Query foods from database
      const foods = await FoodModel.find({}).lean();

      console.log("=== RECOMMENDATION DEBUG ===");
      console.log(`Total foods: ${foods.length}`);
      console.log(`User allergens: ${JSON.stringify(userAllergens)}`);
      console.log(`Macro preferences: ${JSON.stringify(macroPreference)}`);
      console.log(`Daily recommendation:`, dailyRecommendation);
      console.log(`Meal targets:`, JSON.stringify(mealTargets, null, 2));

      // Helper function to check if food matches macro preferences
      const matchesMacroPreference = (
        foodCalories: number,
        foodCarbs: number,
        foodProtein: number,
        foodFat: number
      ): boolean => {
        // If no preferences specified, all foods match
        if (
          !macroPreference.highProtein &&
          !macroPreference.highCarbs &&
          !macroPreference.highFat &&
          !macroPreference.highCal
        ) {
          return true;
        }

        // High calorie: >400 cal per serving
        if (macroPreference.highCal && foodCalories < 400) {
          return false;
        }

        // Calculate macro percentages of total calories
        const proteinCals = foodProtein * 4;
        const carbsCals = foodCarbs * 4;
        const fatCals = foodFat * 9;
        const totalCals = proteinCals + carbsCals + fatCals;

        if (totalCals === 0) return false;

        const proteinPercent = (proteinCals / totalCals) * 100;
        const carbsPercent = (carbsCals / totalCals) * 100;
        const fatPercent = (fatCals / totalCals) * 100;

        // High protein: >30% calories from protein
        if (macroPreference.highProtein && proteinPercent < 30) {
          return false;
        }

        // High carbs: >50% calories from carbs
        if (macroPreference.highCarbs && carbsPercent < 50) {
          return false;
        }

        // High fat: >35% calories from fat
        if (macroPreference.highFat && fatPercent < 35) {
          return false;
        }

        return true;
      };

      // Helper function to categorize food by meal type based on calories and composition
      // This is more realistic than trying to match full meal macro targets
      const isSuitableForMeal = (
        foodCalories: number,
        _foodProtein: number,
        mealType: "breakfast" | "lunch" | "dinner" | "snacks"
      ) => {
        if (foodCalories === 0) return false;

        switch (mealType) {
          case "breakfast":
            // Light to moderate: 100-500 cal
            return foodCalories >= 100 && foodCalories <= 500;

          case "lunch":
            // Moderate to hearty: 150-600 cal (main meal)
            return foodCalories >= 150 && foodCalories <= 600;

          case "dinner":
            // Moderate to hearty: 150-550 cal
            return foodCalories >= 150 && foodCalories <= 550;

          case "snacks":
            // Light: 50-250 cal
            return foodCalories >= 50 && foodCalories <= 250;

          default:
            return false;
        }
      };

      // Filter foods for each meal type
      let allergensSkipped = 0;
      let noMacrosSkipped = 0;
      let lunchCandidates = 0;
      let lunchMatched = 0;

      for (const food of foods) {
        // Check for allergen conflicts using comprehensive mapping
        if (hasAllergen(food.common_ingredients, userAllergens)) {
          allergensSkipped++;
          if (allergensSkipped <= 3) {
            console.log(
              `[ALLERGEN] Skipped "${
                food.name
              }" - ingredients: ${JSON.stringify(food.common_ingredients)}`
            );
          }
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

        // Skip foods with no macro data
        if (
          foodCalories === 0 &&
          foodCarbs === 0 &&
          foodProtein === 0 &&
          foodFat === 0
        ) {
          noMacrosSkipped++;
          continue;
        }

        // Log first 3 foods that pass allergen check for lunch analysis
        lunchCandidates++;
        if (lunchCandidates <= 3) {
          console.log(`[FOOD ${lunchCandidates}] "${food.name}"`);
          console.log(
            `  Macros: cal=${foodCalories}, carbs=${foodCarbs}, protein=${foodProtein}, fat=${foodFat}`
          );
          console.log(
            `  Suitable for lunch (150-600 cal)? ${
              foodCalories >= 150 && foodCalories <= 600
            }`
          );
          console.log(
            `  Matches macro preference? ${matchesMacroPreference(
              foodCalories,
              foodCarbs,
              foodProtein,
              foodFat
            )}`
          );
        }

        // Apply macro preference filter
        if (
          !matchesMacroPreference(foodCalories, foodCarbs, foodProtein, foodFat)
        ) {
          continue;
        }

        // Check which meal types this food is suitable for
        if (isSuitableForMeal(foodCalories, foodProtein, "breakfast")) {
          recommendations.breakfast.push(food.name);
        }

        if (isSuitableForMeal(foodCalories, foodProtein, "lunch")) {
          recommendations.lunch.push(food.name);
          lunchMatched++;
          if (lunchMatched <= 3) {
            console.log(`[LUNCH MATCH] "${food.name}"`);
          }
        }

        if (isSuitableForMeal(foodCalories, foodProtein, "dinner")) {
          recommendations.dinner.push(food.name);
        }

        if (isSuitableForMeal(foodCalories, foodProtein, "snacks")) {
          recommendations.snacks.push(food.name);
        }
      }

      console.log(`\n=== SUMMARY ===`);
      console.log(`Allergens skipped: ${allergensSkipped}`);
      console.log(`No macros skipped: ${noMacrosSkipped}`);
      console.log(`Foods checked for lunch: ${lunchCandidates}`);
      console.log(`Lunch matches: ${lunchMatched}`);
      console.log(
        `Final counts - B:${recommendations.breakfast.length}, L:${recommendations.lunch.length}, D:${recommendations.dinner.length}, S:${recommendations.snacks.length}`
      );

      // Limit recommendations per meal to avoid overwhelming response
      recommendations.breakfast = recommendations.breakfast.slice(0, 10);
      recommendations.lunch = recommendations.lunch.slice(0, 10);
      recommendations.dinner = recommendations.dinner.slice(0, 10);
      recommendations.snacks = recommendations.snacks.slice(0, 10);
    }

    res.status(200).json({
      message: "Daily recommendations retrieved",
      recommendations,
      mealDistribution: {
        breakfast: "25%",
        lunch: "35%",
        dinner: "30%",
        snacks: "10%",
      },
      appliedFilters: macroPreference,
    });
  } catch (error) {
    console.error("Error getting daily recommendations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
