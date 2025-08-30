import mongoose, { Document, Schema } from "mongoose";

export interface NutritionalData {
  [key: string]: number;
}

export interface DietHistory {
  date: Date;
  nutritionalData: NutritionalData[];
}

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
});

export default mongoose.model<IUserAccount>("UserAccount", UserAccountSchema);
