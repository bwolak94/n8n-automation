import { NotFoundError } from "../../shared/errors/index.js";
import type { CredentialRepository } from "./CredentialRepository.js";
import type { CredentialEncryption } from "./CredentialEncryption.js";

// ─── Input / Output DTOs ──────────────────────────────────────────────────────

export interface CredentialCreateDto {
  name: string;
  type: string;
  data: Record<string, string>;
}

export interface CredentialUpdateDto {
  name?: string;
  data?: Record<string, string>;
}

export interface CredentialSummary {
  id: string;
  name: string;
  type: string;
  createdAt: Date;
}

// ─── CredentialService ────────────────────────────────────────────────────────

export class CredentialService {
  constructor(
    private readonly repository: CredentialRepository,
    private readonly encryption: CredentialEncryption
  ) {}

  async createCredential(
    tenantId: string,
    dto: CredentialCreateDto
  ): Promise<CredentialSummary> {
    const plaintext = JSON.stringify(dto.data);
    const encrypted = this.encryption.encrypt(plaintext, tenantId);
    const record = await this.repository.create({
      tenantId,
      name: dto.name,
      type: dto.type,
      encrypted,
    });
    return toSummary(record);
  }

  async listCredentials(tenantId: string): Promise<CredentialSummary[]> {
    const records = await this.repository.findAllByTenant(tenantId);
    return records.map(toSummary);
  }

  async getCredentialSummary(tenantId: string, id: string): Promise<CredentialSummary> {
    const record = await this.repository.findById(id, tenantId);
    if (!record) throw new NotFoundError(`Credential '${id}' not found`);
    return toSummary(record);
  }

  /** For engine use only — returns decrypted fields. Never expose via API. */
  async getCredentialData(
    tenantId: string,
    id: string
  ): Promise<Record<string, string>> {
    const record = await this.repository.findById(id, tenantId);
    if (!record) throw new NotFoundError(`Credential '${id}' not found`);
    return JSON.parse(
      this.encryption.decrypt(record.encrypted, tenantId)
    ) as Record<string, string>;
  }

  async updateCredential(
    tenantId: string,
    id: string,
    dto: CredentialUpdateDto
  ): Promise<CredentialSummary> {
    const updates: { name?: string; encrypted?: ReturnType<CredentialEncryption["encrypt"]> } = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.data !== undefined) {
      updates.encrypted = this.encryption.encrypt(JSON.stringify(dto.data), tenantId);
    }
    const record = await this.repository.update(id, tenantId, updates);
    return toSummary(record);
  }

  async deleteCredential(tenantId: string, id: string): Promise<void> {
    await this.repository.delete(id, tenantId);
  }

  /**
   * Resolves credential names to their decrypted data maps.
   * Used by NodeExecutor to inject credentials into expression context.
   * Returns { credentialName: { field: value, ... } }
   */
  async resolveForExecution(
    tenantId: string,
    names: string[]
  ): Promise<Record<string, Record<string, string>>> {
    if (names.length === 0) return {};

    const result: Record<string, Record<string, string>> = {};
    await Promise.all(
      names.map(async (name) => {
        const record = await this.repository.findByName(name, tenantId);
        if (record) {
          result[name] = JSON.parse(
            this.encryption.decrypt(record.encrypted, tenantId)
          ) as Record<string, string>;
        }
      })
    );
    return result;
  }
}

function toSummary(record: { id: string; name: string; type: string; createdAt: Date }): CredentialSummary {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    createdAt: record.createdAt,
  };
}
