import mongoose, { Document, Schema } from "mongoose";

export type ScanResultType = {
  id?: any;
  name?: string;
  foodName?: string;
  brand?: string;
  servingSize: string;
  ingredients: string[];
  triggeredAllergens: { ingredient: string; allergen: string }[];
  nutritionData: {
    title: string;
    items: {
      name: string;
      value: number;
      unit: string;
    }[];
  }[];
  source?: string; // "usda" | "nutritionix" | "open food facts" | "gemini" | "mynetdiary"
  quantity?: number; // quantity scanned
};

export interface DietHistory {
  date: string; // Store date as string in "YYYY-MM-DD" format
  breakfast: ScanResultType[];
  lunch: ScanResultType[];
  dinner: ScanResultType[];
  otherMealTime: ScanResultType[];
}

export interface LoggedWeight {
  value: number;
  date: string; // Optional date field in "YYYY-MM-DD" format
}

export type DailyRecommendationType = {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
};

export interface IUserAccount extends Document {
  gmailId?: string;
  profileLink?: string;
  profilePublicId?: string; // Optional field for public profile ID
  gender?: string;
  birthDate?: Date;
  heightFeet?: number; // in feet
  heightInches?: number; // in inches
  weight?: number; // in kg
  weightGoal?: string; // e.g., "lose", "maintain", "gain"
  targetWeight?: number; // in kg
  bmi?: number; // Body Mass Index
  allergens?: string[]; // Array of allergens
  medicalConditions?: string[]; // Array of medical conditions
  dietHistory?: DietHistory[]; // Array of diet history records
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  otp?: string;
  otpExpires?: Date;
  isVerified: boolean;
  loginAttempts: number;
  lockUntil: Date | null;
  loggedWeights: LoggedWeight[];
  dietType?: string;
  dailyRecommendation?: DailyRecommendationType;
  activityLevel?: string;
}

const UserAccountSchema = new Schema<IUserAccount>({
  gmailId: { type: String, unique: true, sparse: true },
  profileLink: { type: String, sparse: true },
  profilePublicId: { type: String, sparse: true }, // Optional field for public profile ID
  birthDate: { type: Date, sparse: true },
  heightFeet: { type: Number, sparse: true }, // in feet
  heightInches: { type: Number, sparse: true }, // in inches
  weight: { type: Number, sparse: true }, // in kg
  targetWeight: { type: Number, sparse: true }, // in kg
  bmi: { type: Number, sparse: true }, // Body Mass Index
  allergens: { type: [String], sparse: true },
  medicalConditions: { type: [String], sparse: true },
  gender: { type: String, sparse: true },
  name: { type: String, sparse: true },
  firstName: { type: String, sparse: true },
  lastName: { type: String, sparse: true },
  email: { type: String, unique: true, sparse: true },
  password: { type: String },
  otp: { type: String },
  otpExpires: { type: Date },
  isVerified: { type: Boolean, default: false },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
  dietHistory: {
    type: [
      {
        date: { type: String, required: true },
        breakfast: { type: [Schema.Types.Mixed], default: [] },
        lunch: { type: [Schema.Types.Mixed], default: [] },
        dinner: { type: [Schema.Types.Mixed], default: [] },
        otherMealTime: { type: [Schema.Types.Mixed], default: [] },
      },
    ],
    default: [],
  },
  loggedWeights: {
    type: [
      {
        value: { type: Number, required: true },
        date: { type: String, required: true }, // Store date as string in "YYYY-MM-DD" format
      },
    ],
    default: [],
  },
  dietType: { type: String, sparse: true },
  dailyRecommendation: {
    type: {
      calories: { type: Number, default: 0 },
      carbs: { type: Number, default: 0 },
      protein: { type: Number, default: 0 },
      fat: { type: Number, default: 0 },
    },
    default: { calories: 0, carbs: 0, protein: 0, fat: 0 },
  },
  activityLevel: { type: String, sparse: true },
});

export default mongoose.model<IUserAccount>("UserAccount", UserAccountSchema);
