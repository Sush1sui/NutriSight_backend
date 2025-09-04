import mongoose, { Document, Schema } from "mongoose";

export interface NutritionalData {
  [key: string]: number;
}

export interface DietHistory {
  date: string; // Store date as string in "YYYY-MM-DD" format
  nutritionalData: NutritionalData[];
  breakfast: { name: string; calorie: number }[];
  lunch: { name: string; calorie: number }[];
  dinner: { name: string; calorie: number }[];
  otherMealTime: { name: string; calorie: number }[];
}

export interface LoggedWeight {
  value: number;
  label:
    | "Jan"
    | "Feb"
    | "Mar"
    | "Apr"
    | "May"
    | "Jun"
    | "Jul"
    | "Aug"
    | "Sep"
    | "Oct"
    | "Nov"
    | "Dec";
  year: number;
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
  loggedWeights: LoggedWeight[];
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
        nutritionalData: [
          {
            type: Object,
            required: true,
          },
        ],
        breakfast: { type: [{ name: String, calorie: Number }], default: [] },
        lunch: { type: [{ name: String, calorie: Number }], default: [] },
        dinner: { type: [{ name: String, calorie: Number }], default: [] },
        otherMealTime: {
          type: [{ name: String, calorie: Number }],
          default: [],
        },
      },
    ],
    default: [],
  },
  loggedWeights: {
    type: [
      {
        value: { type: Number, required: true },
        label: {
          type: String,
          enum: [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ],
          required: true,
        },
        year: { type: Number, required: true }, // <--- this must be present!
      },
    ],
    default: [],
  },
});

export default mongoose.model<IUserAccount>("UserAccount", UserAccountSchema);
