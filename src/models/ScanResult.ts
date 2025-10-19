import mongoose, { Document, Schema } from "mongoose";

export interface IScanResult extends Document {
  name?: string;
  foodName?: string;
  brand?: string;
  servingSize: string;
  ingredients: string[];
  nutritionData: {
    title: string;
    items: {
      name: string;
      value: number;
      unit: string;
    }[];
  }[];
  source?: string; // "usda" | "nutritionix" | "open food facts" | "gemini" | "mynetdiary"
  sourceId?: string; // external API ID for deduplication
  createdAt: Date;
  updatedAt: Date;
}

const ScanResultSchema = new Schema<IScanResult>(
  {
    name: { type: String },
    foodName: { type: String },
    brand: { type: String },
    servingSize: { type: String, required: true },
    ingredients: { type: [String], default: [] },
    nutritionData: {
      type: [
        {
          title: { type: String, required: true },
          items: {
            type: [
              {
                name: { type: String, required: true },
                value: { type: Number, required: true },
                unit: { type: String, required: true },
              },
            ],
            default: [],
          },
        },
      ],
      default: [],
    },
    source: { type: String },
    sourceId: { type: String },
  },
  { timestamps: true }
);

// Index for deduplication
ScanResultSchema.index({ sourceId: 1, source: 1 }, { sparse: true });
ScanResultSchema.index({ name: 1, brand: 1 });

export default mongoose.model<IScanResult>("ScanResult", ScanResultSchema);
