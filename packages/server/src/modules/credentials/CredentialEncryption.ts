import crypto from "crypto";

export interface EncryptedPayload {
  iv: string;         // hex-encoded 96-bit IV
  tag: string;        // hex-encoded 128-bit GCM auth tag
  ciphertext: string; // hex-encoded ciphertext
}

/**
 * AES-256-GCM encryption with per-tenant key derivation via HKDF.
 * The master key is loaded from env; individual tenant keys are derived
 * so that credentials from one tenant cannot be decrypted by another.
 */
export class CredentialEncryption {
  private readonly masterKey: Buffer;

  constructor(masterKeyHex: string) {
    const key = Buffer.from(masterKeyHex, "hex");
    if (key.length !== 32) {
      throw new Error("MASTER_ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
    }
    this.masterKey = key;
  }

  deriveKey(tenantId: string): Buffer {
    const salt = Buffer.from(tenantId, "utf8");
    const info = Buffer.from("credential-vault-v1", "utf8");
    return Buffer.from(
      crypto.hkdfSync("sha256", this.masterKey, salt, info, 32)
    );
  }

  encrypt(plaintext: string, tenantId: string): EncryptedPayload {
    const key = this.deriveKey(tenantId);
    const iv = crypto.randomBytes(12); // 96-bit IV recommended for AES-GCM
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return {
      iv: iv.toString("hex"),
      tag: tag.toString("hex"),
      ciphertext: ciphertext.toString("hex"),
    };
  }

  decrypt(payload: EncryptedPayload, tenantId: string): string {
    const key = this.deriveKey(tenantId);
    const iv = Buffer.from(payload.iv, "hex");
    const tag = Buffer.from(payload.tag, "hex");
    const ct = Buffer.from(payload.ciphertext, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(ct),
      decipher.final(),
    ]).toString("utf8");
  }
}
