import mongoose, { Document, Schema } from "mongoose";

// Types for backward compatibility with frontend
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
  source?: string;
  quantity?: number;
};

export interface DietHistory {
  date: string;
  breakfast: ScanResultType[];
  lunch: ScanResultType[];
  dinner: ScanResultType[];
  otherMealTime: ScanResultType[];
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
  profilePublicId?: string;
  gender?: string;
  birthDate?: Date;
  heightFeet?: number;
  heightInches?: number;
  weight?: number;
  weightGoal?: string;
  targetWeight?: number;
  bmi?: number;
  allergens?: string[];
  medicalConditions?: string[];
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
  dietType?: string;
  dailyRecommendation?: DailyRecommendationType;
  activityLevel?: string;
}

const UserAccountSchema = new Schema<IUserAccount>({
  gmailId: { type: String, unique: true, sparse: true },
  profileLink: { type: String, sparse: true },
  profilePublicId: { type: String, sparse: true },
  birthDate: { type: Date, sparse: true },
  heightFeet: { type: Number, sparse: true },
  heightInches: { type: Number, sparse: true },
  weight: { type: Number, sparse: true },
  targetWeight: { type: Number, sparse: true },
  bmi: { type: Number, sparse: true },
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
