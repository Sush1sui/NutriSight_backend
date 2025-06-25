import mongoose, { Document, Schema } from "mongoose";

export interface IUserAccount extends Document {
  gmailId?: string;
  name?: string;
  email?: string;
  password?: string;
  otp?: string;
  otpExpires?: Date;
  isVerified: boolean;
}

const UserAccountSchema = new Schema<IUserAccount>({
  gmailId: { type: String, unique: true, sparse: true },
  name: { type: String },
  email: { type: String, unique: true, sparse: true },
  password: { type: String },
  otp: { type: String },
  otpExpires: { type: Date },
  isVerified: { type: Boolean, default: false },
});

export default mongoose.model<IUserAccount>("UserAccount", UserAccountSchema);
