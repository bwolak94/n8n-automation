import mongoose, { type Document, type Model } from "mongoose";
import { CredentialType } from "@automation-hub/shared";

interface IEncryptedPayload {
  iv: string;
  tag: string;
  ciphertext: string;
}

export interface ICredential extends Document {
  tenantId: string;
  name: string;
  type: string;
  encrypted: IEncryptedPayload;
  createdAt: Date;
  updatedAt: Date;
}

const encryptedPayloadSchema = new mongoose.Schema<IEncryptedPayload>(
  {
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    ciphertext: { type: String, required: true },
  },
  { _id: false }
);

const credentialSchema = new mongoose.Schema<ICredential>(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: Object.values(CredentialType),
      required: true,
    },
    encrypted: { type: encryptedPayloadSchema, required: true },
  },
  { timestamps: true }
);

credentialSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export const CredentialModel: Model<ICredential> =
  mongoose.models["Credential"] ??
  mongoose.model<ICredential>("Credential", credentialSchema);
