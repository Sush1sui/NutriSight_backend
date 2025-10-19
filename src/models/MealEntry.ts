import mongoose, { Document, Schema } from "mongoose";

export interface IMealEntry extends Document {
  userId: mongoose.Types.ObjectId; // ref: 'UserAccount'
  scanResultId: mongoose.Types.ObjectId; // ref: 'ScanResult'
  date: string; // "YYYY-MM-DD"
  mealType: "breakfast" | "lunch" | "dinner" | "otherMealTime";
  quantity: number;
  triggeredAllergens: { ingredient: string; allergen: string }[];
  createdAt: Date;
}

const MealEntrySchema = new Schema<IMealEntry>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "UserAccount",
      required: true,
      index: true,
    },
    scanResultId: {
      type: Schema.Types.ObjectId,
      ref: "ScanResult",
      required: true,
      index: true,
    },
    date: { type: String, required: true, index: true },
    mealType: {
      type: String,
      enum: ["breakfast", "lunch", "dinner", "otherMealTime"],
      required: true,
    },
    quantity: { type: Number, default: 1 },
    triggeredAllergens: [
      {
        ingredient: { type: String, required: true },
        allergen: { type: String, required: true },
      },
    ],
  },
  { timestamps: true }
);

// Compound index for efficient queries
MealEntrySchema.index({ userId: 1, date: 1 });
MealEntrySchema.index({ userId: 1, date: 1, mealType: 1 });

export default mongoose.model<IMealEntry>("MealEntry", MealEntrySchema);
