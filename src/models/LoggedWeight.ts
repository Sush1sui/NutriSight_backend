import mongoose, { Document, Schema } from "mongoose";

export interface ILoggedWeight extends Document {
  userId: mongoose.Types.ObjectId; // ref: 'UserAccount'
  value: number; // in kg
  date: string; // "YYYY-MM-DD"
  createdAt: Date;
}

const LoggedWeightSchema = new Schema<ILoggedWeight>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "UserAccount",
      required: true,
      index: true,
    },
    value: { type: Number, required: true },
    date: { type: String, required: true },
  },
  { timestamps: true }
);

// Compound index for efficient queries
LoggedWeightSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model<ILoggedWeight>(
  "LoggedWeight",
  LoggedWeightSchema
);
