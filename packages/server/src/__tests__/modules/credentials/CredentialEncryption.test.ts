import { describe, expect, it } from "@jest/globals";
import { CredentialEncryption } from "../../../modules/credentials/CredentialEncryption.js";

const MASTER_KEY = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";

describe("CredentialEncryption", () => {
  const enc = new CredentialEncryption(MASTER_KEY);

  describe("constructor", () => {
    it("throws when key is not 32 bytes", () => {
      expect(() => new CredentialEncryption("deadbeef")).toThrow(
        "MASTER_ENCRYPTION_KEY must be 32 bytes (64 hex chars)"
      );
    });

    it("accepts a valid 64-char hex key", () => {
      expect(() => new CredentialEncryption(MASTER_KEY)).not.toThrow();
    });
  });

  describe("deriveKey", () => {
    it("returns a 32-byte buffer", () => {
      const key = enc.deriveKey("tenant-1");
      expect(key.length).toBe(32);
    });

    it("produces different keys for different tenants", () => {
      const k1 = enc.deriveKey("tenant-1");
      const k2 = enc.deriveKey("tenant-2");
      expect(k1.equals(k2)).toBe(false);
    });

    it("is deterministic for the same tenant", () => {
      const k1 = enc.deriveKey("tenant-abc");
      const k2 = enc.deriveKey("tenant-abc");
      expect(k1.equals(k2)).toBe(true);
    });
  });

  describe("encrypt / decrypt round-trip", () => {
    it("decrypts to the original plaintext", () => {
      const plaintext = JSON.stringify({ token: "sk_live_supersecret" });
      const payload = enc.encrypt(plaintext, "tenant-1");
      const decrypted = enc.decrypt(payload, "tenant-1");
      expect(decrypted).toBe(plaintext);
    });

    it("produces different ciphertext on each call (unique IV)", () => {
      const plaintext = "same-secret";
      const p1 = enc.encrypt(plaintext, "tenant-1");
      const p2 = enc.encrypt(plaintext, "tenant-1");
      expect(p1.iv).not.toBe(p2.iv);
      expect(p1.ciphertext).not.toBe(p2.ciphertext);
    });

    it("tenant-A ciphertext cannot be decrypted by tenant-B key", () => {
      const plaintext = "cross-tenant-secret";
      const payload = enc.encrypt(plaintext, "tenant-A");
      expect(() => enc.decrypt(payload, "tenant-B")).toThrow();
    });

    it("handles unicode strings", () => {
      const plaintext = "pässwørd-日本語";
      const payload = enc.encrypt(plaintext, "tenant-x");
      expect(enc.decrypt(payload, "tenant-x")).toBe(plaintext);
    });

    it("encrypted payload fields are hex strings", () => {
      const payload = enc.encrypt("test", "tenant-1");
      expect(payload.iv).toMatch(/^[0-9a-f]+$/);
      expect(payload.tag).toMatch(/^[0-9a-f]+$/);
      expect(payload.ciphertext).toMatch(/^[0-9a-f]+$/);
    });

    it("IV is 24 hex chars (12 bytes)", () => {
      const payload = enc.encrypt("test", "tenant-1");
      expect(payload.iv.length).toBe(24);
    });

    it("auth tag is 32 hex chars (16 bytes)", () => {
      const payload = enc.encrypt("test", "tenant-1");
      expect(payload.tag.length).toBe(32);
    });
  });
});
