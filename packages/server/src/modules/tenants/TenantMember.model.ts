import mongoose, { type Document, type Model } from "mongoose";
import { TenantMemberRole } from "@automation-hub/shared";

interface ITenantMember extends Document {
  tenantId: string;
  userId: string;
  email: string;
  role: TenantMemberRole;
  joinedAt: Date;
}

const tenantMemberSchema = new mongoose.Schema<ITenantMember>(
  {
    tenantId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    email: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(TenantMemberRole),
      required: true,
    },
    joinedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false }
);

tenantMemberSchema.index({ tenantId: 1, userId: 1 }, { unique: true });

export const TenantMemberModel: Model<ITenantMember> =
  mongoose.models["TenantMember"] ??
  mongoose.model<ITenantMember>("TenantMember", tenantMemberSchema);
