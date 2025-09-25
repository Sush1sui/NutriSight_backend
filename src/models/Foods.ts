import mongoose from "mongoose";

export interface FoodDBType {
  name: string;
  nutrition: { name: string; value: number; unit: string }[];
  serving_size: string;
  source: string;
  common_ingredients: string[];
}

const FoodSchema = new mongoose.Schema<FoodDBType>({
  name: { type: String, required: true },
  nutrition: [
    {
      name: { type: String, required: true },
      value: { type: Number, required: true },
      unit: { type: String, required: true },
    },
  ],
  serving_size: { type: String, required: true },
  source: { type: String, required: true },
  common_ingredients: [{ type: String }],
});

const FoodModel = mongoose.model<FoodDBType>("Food", FoodSchema);

export default FoodModel;
