export interface StorageItem {
  key: string;
  size: number;
  lastModified: Date;
  contentType?: string;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

export interface DownloadResult {
  content: Buffer;
  contentType: string;
  size: number;
}

export interface FileMetadata {
  size: number;
  contentType: string;
  lastModified: Date;
}

export interface IStorageProvider {
  upload(key: string, content: Buffer, options?: { contentType?: string }): Promise<UploadResult>;
  download(key: string): Promise<DownloadResult>;
  delete(key: string): Promise<void>;
  list(prefix: string, maxKeys: number): Promise<StorageItem[]>;
  getSignedUrl(key: string, expiresIn: number): Promise<string>;
  getMetadata(key: string): Promise<FileMetadata>;
}
