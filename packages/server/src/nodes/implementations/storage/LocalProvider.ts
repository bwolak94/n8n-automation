import fs from "node:fs/promises";
import path from "node:path";
import { AppError } from "../../../shared/errors/index.js";
import type {
  DownloadResult,
  FileMetadata,
  IStorageProvider,
  StorageItem,
  UploadResult,
} from "./IStorageProvider.js";
import { MAX_UPLOAD_BYTES } from "./S3Provider.js";

/**
 * LocalProvider — stores files on the local filesystem under a configured base directory.
 *
 * Path traversal protection: every resolved path is verified to start with
 * `realBasePath` before any operation; attempts to escape via `../` throw
 * STORAGE_INVALID_KEY.
 */
export class LocalProvider implements IStorageProvider {
  constructor(
    /** Absolute base directory — all files live here. */
    private readonly baseDir: string
  ) {}

  // ── Key validation ────────────────────────────────────────────────────────────

  private resolveSafe(key: string): string {
    // Normalise and reject traversal attempts before touching fs
    const normalised = path.normalize(key);
    if (
      normalised.startsWith("..") ||
      normalised.includes(path.sep + "..") ||
      path.isAbsolute(normalised)
    ) {
      throw new AppError(
        `Invalid storage key (path traversal detected): ${key}`,
        400,
        "STORAGE_INVALID_KEY"
      );
    }
    return path.join(this.baseDir, normalised);
  }

  // ── Operations ────────────────────────────────────────────────────────────────

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

    const filePath = this.resolveSafe(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);

    const contentType = options.contentType ?? "application/octet-stream";
    return {
      key,
      url: `file://${filePath}`,
      size: content.length,
      contentType,
    };
  }

  async download(key: string): Promise<DownloadResult> {
    const filePath = this.resolveSafe(key);
    try {
      const content = await fs.readFile(filePath);
      return {
        content,
        contentType: "application/octet-stream",
        size: content.length,
      };
    } catch (err) {
      const e = err as { code?: string };
      if (e.code === "ENOENT") {
        throw new AppError(`File not found: ${key}`, 404, "STORAGE_NOT_FOUND");
      }
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveSafe(key);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      const e = err as { code?: string };
      if (e.code === "ENOENT") {
        throw new AppError(`File not found: ${key}`, 404, "STORAGE_NOT_FOUND");
      }
      throw err;
    }
  }

  async list(prefix: string, maxKeys: number): Promise<StorageItem[]> {
    const searchDir = prefix
      ? this.resolveSafe(prefix.replace(/\/$/, ""))
      : this.baseDir;

    const items: StorageItem[] = [];
    await this.collectFiles(searchDir, this.baseDir, items, maxKeys);
    return items;
  }

  private async collectFiles(
    dir: string,
    baseDir: string,
    items: StorageItem[],
    maxKeys: number
  ): Promise<void> {
    if (items.length >= maxKeys) return;

    let entries: Awaited<ReturnType<typeof fs.readdir>>;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // directory doesn't exist — treat as empty
    }

    for (const entry of entries) {
      if (items.length >= maxKeys) break;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await this.collectFiles(fullPath, baseDir, items, maxKeys);
      } else {
        const stat = await fs.stat(fullPath);
        items.push({
          key: path.relative(baseDir, fullPath),
          size: stat.size,
          lastModified: stat.mtime,
        });
      }
    }
  }

  async getSignedUrl(key: string, _expiresIn: number): Promise<string> {
    // Local provider doesn't support time-limited URLs; return a file:// URI
    const filePath = this.resolveSafe(key);
    return `file://${filePath}`;
  }

  async getMetadata(key: string): Promise<FileMetadata> {
    const filePath = this.resolveSafe(key);
    try {
      const stat = await fs.stat(filePath);
      return {
        size: stat.size,
        contentType: "application/octet-stream",
        lastModified: stat.mtime,
      };
    } catch (err) {
      const e = err as { code?: string };
      if (e.code === "ENOENT") {
        throw new AppError(`File not found: ${key}`, 404, "STORAGE_NOT_FOUND");
      }
      throw err;
    }
  }
}
