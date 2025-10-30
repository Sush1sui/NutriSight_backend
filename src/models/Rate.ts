import mongoose from "mongoose";

export interface IRateDoc extends mongoose.Document {
  key: string;
  count: number;
  createdAt: Date;
  expireAt?: Date;
}

const RateSchema = new mongoose.Schema<IRateDoc>(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    expireAt: { type: Date, required: false },
  },
  { timestamps: false }
);

// TTL index: documents will be removed when expireAt <= now
RateSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const Rate =
  mongoose.models.Rate || mongoose.model<IRateDoc>("Rate", RateSchema);

export default Rate;
