import { NotFoundError } from "../../shared/errors/index.js";
import { CredentialModel, type ICredential } from "./Credential.model.js";
import type { EncryptedPayload } from "./CredentialEncryption.js";

export interface CredentialRecord {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  encrypted: EncryptedPayload;
  createdAt: Date;
}

export interface CreateCredentialInput {
  tenantId: string;
  name: string;
  type: string;
  encrypted: EncryptedPayload;
}

export interface UpdateCredentialInput {
  name?: string;
  encrypted?: EncryptedPayload;
}

function toRecord(doc: ICredential): CredentialRecord {
  return {
    id: (doc._id as { toString(): string }).toString(),
    tenantId: doc.tenantId,
    name: doc.name,
    type: doc.type,
    encrypted: doc.encrypted as unknown as EncryptedPayload,
    createdAt: doc.createdAt,
  };
}

export class CredentialRepository {
  async create(input: CreateCredentialInput): Promise<CredentialRecord> {
    const doc = await CredentialModel.create(input);
    return toRecord(doc);
  }

  async findById(id: string, tenantId: string): Promise<CredentialRecord | null> {
    const doc = await CredentialModel.findOne({ _id: id, tenantId }).lean();
    if (!doc) return null;
    return toRecord(doc as unknown as ICredential);
  }

  async findAllByTenant(tenantId: string): Promise<CredentialRecord[]> {
    const docs = await CredentialModel.find({ tenantId }).lean();
    return (docs as unknown as ICredential[]).map(toRecord);
  }

  async findByName(name: string, tenantId: string): Promise<CredentialRecord | null> {
    const doc = await CredentialModel.findOne({ name, tenantId }).lean();
    if (!doc) return null;
    return toRecord(doc as unknown as ICredential);
  }

  async update(
    id: string,
    tenantId: string,
    input: UpdateCredentialInput
  ): Promise<CredentialRecord> {
    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates["name"] = input.name;
    if (input.encrypted !== undefined) updates["encrypted"] = input.encrypted;

    const doc = await CredentialModel.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: updates },
      { new: true }
    ).lean();

    if (!doc) throw new NotFoundError(`Credential '${id}' not found`);
    return toRecord(doc as unknown as ICredential);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const result = await CredentialModel.deleteOne({ _id: id, tenantId });
    if (result.deletedCount === 0) {
      throw new NotFoundError(`Credential '${id}' not found`);
    }
  }
}
