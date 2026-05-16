import crypto from "node:crypto";
import { AppError } from "../../../shared/errors/index.js";
import type {
  DownloadResult,
  FileMetadata,
  IStorageProvider,
  StorageItem,
  UploadResult,
} from "./IStorageProvider.js";
import { MAX_UPLOAD_BYTES } from "./S3Provider.js";

export interface GCSCredentials {
  client_email: string;
  private_key: string;
  project_id?: string;
}

// ─── JWT helpers (service-account auth for GCS REST API) ─────────────────────

function base64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf) : buf;
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function makeJwt(email: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/devstorage.full_control",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );

  const signingInput = `${header}.${payload}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signingInput);
  const sig = base64url(sign.sign(privateKey));
  return `${signingInput}.${sig}`;
}

async function getAccessToken(credentials: GCSCredentials): Promise<string> {
  const jwt = makeJwt(credentials.client_email, credentials.private_key);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!response.ok) {
    throw new AppError("Failed to obtain GCS access token", 401, "STORAGE_GCS_AUTH_FAILED");
  }
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const GCS_BASE = "https://storage.googleapis.com";

export class GCSProvider implements IStorageProvider {
  constructor(
    private readonly credentials: GCSCredentials,
    private readonly bucket: string
  ) {}

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await getAccessToken(this.credentials);
    return { Authorization: `Bearer ${token}` };
  }

  async upload(
    key: string,
    content: Buffer,
    options: { contentType?: string } = {}
  ): Promise<UploadResult> {
    if (content.length > MAX_UPLOAD_BYTES) {
      throw new AppError(
        `File size ${content.length} bytes exceeds the 100 MB upload limit`,
        413,
        "STORAGE_SIZE_EXCEEDED"
      );
    }

    const contentType = options.contentType ?? "application/octet-stream";
    const headers = await this.authHeaders();
    const encodedKey = encodeURIComponent(key);

    const response = await fetch(
      `${GCS_BASE}/upload/storage/v1/b/${this.bucket}/o?uploadType=media&name=${encodedKey}`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": contentType },
        body: content,
      }
    );

    if (!response.ok) {
      throw new AppError(`GCS upload failed: ${response.status}`, response.status, "STORAGE_UPLOAD_FAILED");
    }

    return {
      key,
      url: `${GCS_BASE}/storage/v1/b/${this.bucket}/o/${encodedKey}`,
      size: content.length,
      contentType,
    };
  }

  async download(key: string): Promise<DownloadResult> {
    const headers = await this.authHeaders();
    const encodedKey = encodeURIComponent(key);
    const response = await fetch(
      `${GCS_BASE}/storage/v1/b/${this.bucket}/o/${encodedKey}?alt=media`,
      { headers }
    );

    if (response.status === 404) {
      throw new AppError(`Object not found: ${key}`, 404, "STORAGE_NOT_FOUND");
    }
    if (!response.ok) {
      throw new AppError(`GCS download failed: ${response.status}`, response.status, "STORAGE_DOWNLOAD_FAILED");
    }

    const buf = Buffer.from(await response.arrayBuffer());
    return {
      content: buf,
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
      size: buf.length,
    };
  }

  async delete(key: string): Promise<void> {
    const headers = await this.authHeaders();
    const encodedKey = encodeURIComponent(key);
    const response = await fetch(
      `${GCS_BASE}/storage/v1/b/${this.bucket}/o/${encodedKey}`,
      { method: "DELETE", headers }
    );
    if (response.status !== 204 && response.status !== 200) {
      throw new AppError(`GCS delete failed: ${response.status}`, response.status, "STORAGE_DELETE_FAILED");
    }
  }

  async list(prefix: string, maxKeys: number): Promise<StorageItem[]> {
    const headers = await this.authHeaders();
    const url = new URL(`${GCS_BASE}/storage/v1/b/${this.bucket}/o`);
    if (prefix) url.searchParams.set("prefix", prefix);
    url.searchParams.set("maxResults", String(maxKeys));

    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      throw new AppError(`GCS list failed: ${response.status}`, response.status, "STORAGE_LIST_FAILED");
    }

    const data = (await response.json()) as {
      items?: Array<{ name: string; size: string; timeCreated: string; contentType?: string }>;
    };

    return (data.items ?? []).map((item) => ({
      key: item.name,
      size: parseInt(item.size, 10),
      lastModified: new Date(item.timeCreated),
      contentType: item.contentType,
    }));
  }

  async getSignedUrl(key: string, expiresIn: number): Promise<string> {
    // V4 signed URL for GCS using service account private key
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const dateTimeStr = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const credentialScope = `${dateStr}/auto/storage/goog4_request`;
    const credential = `${this.credentials.client_email}/${credentialScope}`;

    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    const host = `storage.googleapis.com`;
    const path = `/${this.bucket}/${encodedKey}`;

    const headers = `host:${host}\n`;
    const signedHeaders = "host";

    const queryString = [
      `X-Goog-Algorithm=GOOG4-RSA-SHA256`,
      `X-Goog-Credential=${encodeURIComponent(credential)}`,
      `X-Goog-Date=${dateTimeStr}`,
      `X-Goog-Expires=${expiresIn}`,
      `X-Goog-SignedHeaders=${signedHeaders}`,
    ].join("&");

    const canonicalRequest = [
      "GET",
      path,
      queryString,
      headers,
      signedHeaders,
      "UNSIGNED-PAYLOAD",
    ].join("\n");

    const canonicalHash = crypto
      .createHash("sha256")
      .update(canonicalRequest)
      .digest("hex");

    const stringToSign = [
      "GOOG4-RSA-SHA256",
      dateTimeStr,
      credentialScope,
      canonicalHash,
    ].join("\n");

    const sign = crypto.createSign("RSA-SHA256");
    sign.update(stringToSign);
    const signature = sign.sign(this.credentials.private_key, "hex");

    return `https://${host}${path}?${queryString}&X-Goog-Signature=${signature}`;
  }

  async getMetadata(key: string): Promise<FileMetadata> {
    const headers = await this.authHeaders();
    const encodedKey = encodeURIComponent(key);
    const response = await fetch(
      `${GCS_BASE}/storage/v1/b/${this.bucket}/o/${encodedKey}`,
      { headers }
    );

    if (response.status === 404) {
      throw new AppError(`Object not found: ${key}`, 404, "STORAGE_NOT_FOUND");
    }
    if (!response.ok) {
      throw new AppError(`GCS metadata failed: ${response.status}`, response.status, "STORAGE_METADATA_FAILED");
    }

    const data = (await response.json()) as {
      size: string;
      contentType?: string;
      timeCreated: string;
    };

    return {
      size: parseInt(data.size, 10),
      contentType: data.contentType ?? "application/octet-stream",
      lastModified: new Date(data.timeCreated),
    };
  }
}
