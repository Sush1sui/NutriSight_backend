import mongoose, { Document, Schema } from "mongoose";

interface NutritionalData {
  [key: string]: number;
}

interface DietHistory {
  date: Date;
  nutritionalData: NutritionalData[];
}

export interface IUserAccount extends Document {
  gmailId?: string;
  profileLink?: string;
  profilePublicId?: string; // Optional field for public profile ID
  gender?: string;
  birthdate?: Date;
  height?: number; // in feet
  weight?: number; // in kg
  targetWeight?: number; // in kg
  bmi?: number; // Body Mass Index
  allergens?: string[]; // Array of allergens
  medicalConditions?: string[]; // Array of medical conditions
  dietHistory?: DietHistory[]; // Array of diet history records
  name?: string;
  email?: string;
  password?: string;
  otp?: string;
  otpExpires?: Date;
  isVerified: boolean;
}

const UserAccountSchema = new Schema<IUserAccount>({
  gmailId: { type: String, unique: true, sparse: true },
  profileLink: { type: String, sparse: true },
  profilePublicId: { type: String, sparse: true }, // Optional field for public profile ID
  birthdate: { type: Date, sparse: true },
  height: { type: Number, sparse: true }, // in feet
  weight: { type: Number, sparse: true }, // in kg
  targetWeight: { type: Number, sparse: true }, // in kg
  bmi: { type: Number, sparse: true }, // Body Mass Index
  allergens: { type: [String], sparse: true },
  medicalConditions: { type: [String], sparse: true },
  gender: { type: String, sparse: true },
  name: { type: String },
  email: { type: String, unique: true, sparse: true },
  password: { type: String },
  otp: { type: String },
  otpExpires: { type: Date },
  isVerified: { type: Boolean, default: false },
});

export default mongoose.model<IUserAccount>("UserAccount", UserAccountSchema);
