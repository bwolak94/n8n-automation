import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "../../../shared/errors/index.js";
import type {
  DownloadResult,
  FileMetadata,
  IStorageProvider,
  StorageItem,
  UploadResult,
} from "./IStorageProvider.js";

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  /** Optional endpoint for S3-compatible providers (MinIO, R2, etc.) */
  endpoint?: string;
}

export class S3Provider implements IStorageProvider {
  private readonly client: S3Client;

  constructor(
    credentials: S3Credentials,
    private readonly bucket: string
  ) {
    this.client = new S3Client({
      region: credentials.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
      ...(credentials.endpoint ? { endpoint: credentials.endpoint, forcePathStyle: true } : {}),
    });
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

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: contentType,
        ContentLength: content.length,
      })
    );

    return {
      key,
      url: `https://${this.bucket}.s3.amazonaws.com/${key}`,
      size: content.length,
      contentType,
    };
  }

  async download(key: string): Promise<DownloadResult> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key })
      );

      const chunks: Buffer[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(Buffer.from(chunk));
      }
      const content = Buffer.concat(chunks);

      return {
        content,
        contentType: response.ContentType ?? "application/octet-stream",
        size: response.ContentLength ?? content.length,
      };
    } catch (err) {
      const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) {
        throw new AppError(`Object not found: ${key}`, 404, "STORAGE_NOT_FOUND");
      }
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    );
  }

  async list(prefix: string, maxKeys: number): Promise<StorageItem[]> {
    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix || undefined,
        MaxKeys: maxKeys,
      })
    );

    return (response.Contents ?? []).map((obj) => ({
      key: obj.Key ?? "",
      size: obj.Size ?? 0,
      lastModified: obj.LastModified ?? new Date(),
    }));
  }

  async getSignedUrl(key: string, expiresIn: number): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn });
  }

  async getMetadata(key: string): Promise<FileMetadata> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key })
      );
      return {
        size: response.ContentLength ?? 0,
        contentType: response.ContentType ?? "application/octet-stream",
        lastModified: response.LastModified ?? new Date(),
      };
    } catch (err) {
      const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (e.name === "NotFound" || e.$metadata?.httpStatusCode === 404) {
        throw new AppError(`Object not found: ${key}`, 404, "STORAGE_NOT_FOUND");
      }
      throw err;
    }
  }
}
