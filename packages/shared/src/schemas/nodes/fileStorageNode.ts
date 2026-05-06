import { z } from "zod";

export const FileStorageProviderSchema = z.enum(["s3", "gcs", "local"]);
export type FileStorageProvider = z.infer<typeof FileStorageProviderSchema>;

export const FileStorageOperationSchema = z.enum([
  "upload",
  "download",
  "delete",
  "list",
  "signedUrl",
  "metadata",
]);
export type FileStorageOperation = z.infer<typeof FileStorageOperationSchema>;

export const ContentEncodingSchema = z.enum(["utf8", "base64"]);
export type ContentEncoding = z.infer<typeof ContentEncodingSchema>;

export const FileStorageNodeConfigSchema = z.object({
  provider: FileStorageProviderSchema,
  /** Not required for local provider */
  credentialId: z.string().optional(),
  /** Bucket name (or local sub-directory prefix) */
  bucket: z.string().min(1, "Bucket is required"),
  /** Object key — expression-enabled (resolved before execute) */
  key: z.string().optional(),
  operation: FileStorageOperationSchema,
  /** Content to upload (expression-enabled) */
  content: z.string().optional(),
  contentEncoding: ContentEncodingSchema.default("utf8"),
  contentType: z.string().optional(),
  /** Pre-signed URL lifetime in seconds (1s – 7 days) */
  signedUrlExpiresIn: z.number().int().min(1).max(604800).default(3600),
  /** Maximum items returned by list operation */
  maxKeys: z.number().int().min(1).max(1000).default(100),
  /** Optional prefix filter for list operation */
  listPrefix: z.string().default(""),
});

export type FileStorageNodeConfig = z.infer<typeof FileStorageNodeConfigSchema>;
