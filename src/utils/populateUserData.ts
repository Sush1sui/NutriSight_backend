import mongoose from "mongoose";
import MealEntry from "../models/MealEntry";
import LoggedWeight from "../models/LoggedWeight";
import { DietHistory, ScanResultType } from "../models/UserAccount";

/**
 * Helper function to build diet history response in old format
 */
export async function buildDietHistoryResponse(
  userId: mongoose.Types.ObjectId | string
): Promise<DietHistory[]> {
  const mealEntries = await MealEntry.find({ userId })
    .populate("scanResultId")
    .sort({ date: -1 });

  // Group by date
  const groupedByDate: Record<string, DietHistory> = {};

  for (const entry of mealEntries) {
    const dateStr = entry.date;
    if (!groupedByDate[dateStr]) {
      groupedByDate[dateStr] = {
        date: dateStr,
        breakfast: [],
        lunch: [],
        dinner: [],
        otherMealTime: [],
      };
    }

    const scanResult = entry.scanResultId as any;
    const mealData: ScanResultType & { quantity: number } = {
      id: (entry._id as mongoose.Types.ObjectId).toString(),
      name: scanResult.name,
      foodName: scanResult.foodName,
      brand: scanResult.brand,
      servingSize: scanResult.servingSize,
      ingredients: scanResult.ingredients,
      triggeredAllergens: entry.triggeredAllergens,
      nutritionData: scanResult.nutritionData,
      source: scanResult.source,
      quantity: entry.quantity,
    };

    groupedByDate[dateStr][entry.mealType].push(mealData);
  }

  return Object.values(groupedByDate);
}

/**
 * Helper function to get logged weights
 */
export async function buildLoggedWeightsResponse(
  userId: mongoose.Types.ObjectId | string
): Promise<Array<{ value: number; date: string }>> {
  const weights = await LoggedWeight.find({ userId }).sort({ date: -1 });
  return weights.map((w) => ({ value: w.value, date: w.date }));
}

/**
 * Populate user object with dietHistory and loggedWeights
 * This ensures frontend compatibility after hot reload
 */
export async function populateUserWithDynamicData(userObj: any) {
  const userId = userObj._id;

  // Fetch and attach dietHistory
  const dietHistory = await buildDietHistoryResponse(userId);
  userObj.dietHistory = dietHistory;

  // Fetch and attach loggedWeights
  const loggedWeights = await buildLoggedWeightsResponse(userId);
  userObj.loggedWeights = loggedWeights;

  return userObj;
}
