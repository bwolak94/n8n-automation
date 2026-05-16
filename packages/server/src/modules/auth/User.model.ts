import mongoose, { type Document, type Model } from "mongoose";

interface IUser extends Document {
  userId: string;
  email: string;
  passwordHash: string;
  tenantId: string;
  role: string;
  createdAt: Date;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    tenantId: { type: String, required: true },
    role: { type: String, required: true, default: "owner" },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const UserModel: Model<IUser> =
  mongoose.models["User"] ??
  mongoose.model<IUser>("User", userSchema);
