import { AppError } from "../../shared/errors/index.js";
import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";
import type { ICredentialVault } from "./DatabaseNode.js";
import type { IStorageProvider } from "./storage/IStorageProvider.js";
import { S3Provider } from "./storage/S3Provider.js";
import type { S3Credentials } from "./storage/S3Provider.js";
import { GCSProvider } from "./storage/GCSProvider.js";
import type { GCSCredentials } from "./storage/GCSProvider.js";
import { LocalProvider } from "./storage/LocalProvider.js";
import { FileStorageNodeConfigSchema } from "@automation-hub/shared";
import { env } from "../../config/env.js";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

// ─── Provider factory ─────────────────────────────────────────────────────────

export type StorageProviderFactory = (
  provider: "s3" | "gcs" | "local",
  credentials: Record<string, string>,
  bucket: string
) => IStorageProvider;

function defaultProviderFactory(
  provider: "s3" | "gcs" | "local",
  credentials: Record<string, string>,
  bucket: string
): IStorageProvider {
  switch (provider) {
    case "s3":
      return new S3Provider(credentials as unknown as S3Credentials, bucket);
    case "gcs":
      return new GCSProvider(parseGCSCredentials(credentials), bucket);
    case "local":
      return new LocalProvider(env.STORAGE_LOCAL_PATH);
  }
}

function parseGCSCredentials(cred: Record<string, string>): GCSCredentials {
  // Accept either a flat object or a service account JSON string
  if (cred["serviceAccountJson"]) {
    const parsed = JSON.parse(cred["serviceAccountJson"]) as GCSCredentials;
    return parsed;
  }
  return {
    client_email: cred["client_email"] ?? "",
    private_key: cred["private_key"] ?? "",
    project_id: cred["project_id"],
  };
}

// ─── Node ─────────────────────────────────────────────────────────────────────

export class FileStorageNode implements INode {
  readonly definition: NodeDefinition = {
    type: "file_storage",
    name: "File Storage",
    description:
      "Read and write files to cloud object storage (AWS S3, Google Cloud Storage) or local disk",
  };

  private readonly providerFactory: StorageProviderFactory;

  constructor(
    private readonly credentialVault?: ICredentialVault,
    providerFactory?: StorageProviderFactory
  ) {
    this.providerFactory = providerFactory ?? defaultProviderFactory;
  }

  async execute(
    _input: unknown,
    config: Readonly<Record<string, unknown>>,
    context: ExecutionContext
  ): Promise<NodeOutput> {
    const parsed = FileStorageNodeConfigSchema.safeParse(config);
    if (!parsed.success) {
      throw new AppError(
        `FileStorageNode config invalid: ${parsed.error.errors[0]?.message ?? "unknown"}`,
        400,
        "STORAGE_INVALID_CONFIG"
      );
    }

    const {
      provider,
      credentialId,
      bucket,
      key,
      operation,
      content,
      contentEncoding,
      contentType,
      signedUrlExpiresIn,
      maxKeys,
      listPrefix,
    } = parsed.data;

    // Resolve credentials (local provider doesn't need them)
    let credentials: Record<string, string> = {};
    if (provider !== "local") {
      if (!credentialId) {
        throw new AppError(
          `FileStorageNode requires a credentialId for provider '${provider}'`,
          400,
          "STORAGE_MISSING_CREDENTIAL"
        );
      }
      if (!this.credentialVault) {
        throw new AppError(
          "Credential vault is not configured for FileStorageNode",
          500,
          "STORAGE_NO_VAULT"
        );
      }
      credentials = await this.credentialVault.getCredentialData(
        context.tenantId,
        credentialId
      );
    }

    const storageProvider = this.providerFactory(provider, credentials, bucket);

    switch (operation) {
      case "upload": {
        const effectiveKey = requireKey(key, "upload");
        const uploadBuffer = resolveContent(content, contentEncoding);
        if (uploadBuffer.byteLength > MAX_UPLOAD_BYTES) {
          throw new AppError("Content exceeds maximum upload size of 100MB", 400, "STORAGE_SIZE_EXCEEDED");
        }
        const result = await storageProvider.upload(effectiveKey, uploadBuffer, {
          contentType,
        });
        return {
          data: {
            key: result.key,
            url: result.url,
            size: result.size,
            contentType: result.contentType,
            operation: "upload",
          },
        };
      }

      case "download": {
        const effectiveKey = requireKey(key, "download");
        const result = await storageProvider.download(effectiveKey);
        return {
          data: {
            key: effectiveKey,
            content:
              contentEncoding === "base64"
                ? result.content.toString("base64")
                : result.content.toString("utf8"),
            contentType: result.contentType,
            size: result.size,
            operation: "download",
          },
        };
      }

      case "delete": {
        const effectiveKey = requireKey(key, "delete");
        await storageProvider.delete(effectiveKey);
        return {
          data: { key: effectiveKey, operation: "delete", success: true },
        };
      }

      case "list": {
        const items = await storageProvider.list(listPrefix, maxKeys);
        return {
          data: {
            items: items.map((item) => ({
              key: item.key,
              size: item.size,
              lastModified: item.lastModified.toISOString(),
              contentType: item.contentType,
            })),
            count: items.length,
            prefix: listPrefix,
            operation: "list",
          },
        };
      }

      case "signedUrl": {
        const effectiveKey = requireKey(key, "signedUrl");
        const url = await storageProvider.getSignedUrl(
          effectiveKey,
          signedUrlExpiresIn
        );
        return {
          data: {
            key: effectiveKey,
            url,
            expiresIn: signedUrlExpiresIn,
            operation: "signedUrl",
          },
        };
      }

      case "metadata": {
        const effectiveKey = requireKey(key, "metadata");
        const meta = await storageProvider.getMetadata(effectiveKey);
        return {
          data: {
            key: effectiveKey,
            size: meta.size,
            contentType: meta.contentType,
            lastModified: meta.lastModified.toISOString(),
            operation: "metadata",
          },
        };
      }
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireKey(key: string | undefined, operation: string): string {
  if (!key?.trim()) {
    throw new AppError(
      `FileStorageNode '${operation}' operation requires a non-empty 'key'`,
      400,
      "STORAGE_MISSING_KEY"
    );
  }
  return key;
}

function resolveContent(
  content: string | undefined,
  encoding: "utf8" | "base64"
): Buffer {
  if (!content) {
    return Buffer.alloc(0);
  }
  return encoding === "base64"
    ? Buffer.from(content, "base64")
    : Buffer.from(content, "utf8");
}
