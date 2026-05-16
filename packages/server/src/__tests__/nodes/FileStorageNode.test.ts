import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";
import { FileStorageNode } from "../../nodes/implementations/FileStorageNode.js";
import type { StorageProviderFactory } from "../../nodes/implementations/FileStorageNode.js";
import type { ICredentialVault } from "../../nodes/implementations/DatabaseNode.js";
import { LocalProvider } from "../../nodes/implementations/storage/LocalProvider.js";
import type { IStorageProvider } from "../../nodes/implementations/storage/IStorageProvider.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCtx(): ExecutionContext {
  return { tenantId: "t-1", executionId: "e-1", workflowId: "wf-1", variables: {} };
}

function makeVault(creds: Record<string, string> = { accessKeyId: "key", secretAccessKey: "secret", region: "us-east-1" }): ICredentialVault {
  return {
    getCredentialData: jest.fn<() => Promise<Record<string, string>>>().mockResolvedValue(creds),
  };
}

function baseConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    provider: "s3",
    credentialId: "cred-1",
    bucket: "my-bucket",
    key: "reports/file.txt",
    operation: "upload",
    content: "hello world",
    ...overrides,
  };
}

function makeMockProvider(): IStorageProvider {
  return {
    upload: jest.fn<IStorageProvider["upload"]>().mockResolvedValue({
      key: "reports/file.txt",
      url: "https://my-bucket.s3.amazonaws.com/reports/file.txt",
      size: 11,
      contentType: "text/plain",
    }),
    download: jest.fn<IStorageProvider["download"]>().mockResolvedValue({
      content: Buffer.from("hello world"),
      contentType: "text/plain",
      size: 11,
    }),
    delete: jest.fn<IStorageProvider["delete"]>().mockResolvedValue(undefined),
    list: jest.fn<IStorageProvider["list"]>().mockResolvedValue([
      { key: "reports/file.txt", size: 11, lastModified: new Date("2026-01-01") },
    ]),
    getSignedUrl: jest.fn<IStorageProvider["getSignedUrl"]>().mockResolvedValue(
      "https://my-bucket.s3.amazonaws.com/reports/file.txt?X-Amz-Expires=3600"
    ),
    getMetadata: jest.fn<IStorageProvider["getMetadata"]>().mockResolvedValue({
      size: 11,
      contentType: "text/plain",
      lastModified: new Date("2026-01-01"),
    }),
  };
}

function makeNode(mockProvider?: IStorageProvider, vault?: ICredentialVault): FileStorageNode {
  const factory: StorageProviderFactory = () => mockProvider ?? makeMockProvider();
  return new FileStorageNode(vault ?? makeVault(), factory);
}

// ─── FileStorageNode tests ────────────────────────────────────────────────────

describe("FileStorageNode", () => {
  let mockProvider: IStorageProvider;
  let node: FileStorageNode;

  beforeEach(() => {
    mockProvider = makeMockProvider();
    node = makeNode(mockProvider);
  });

  // ── Definition ──────────────────────────────────────────────────────────────

  it("has type 'file_storage'", () => {
    expect(node.definition.type).toBe("file_storage");
  });

  // ── Config validation ────────────────────────────────────────────────────────

  it("throws STORAGE_INVALID_CONFIG when provider is unknown", async () => {
    await expect(
      node.execute({}, baseConfig({ provider: "azure" }), makeCtx())
    ).rejects.toMatchObject({ code: "STORAGE_INVALID_CONFIG" });
  });

  it("throws STORAGE_INVALID_CONFIG when bucket is empty", async () => {
    await expect(
      node.execute({}, baseConfig({ bucket: "" }), makeCtx())
    ).rejects.toMatchObject({ code: "STORAGE_INVALID_CONFIG" });
  });

  it("throws STORAGE_MISSING_KEY when key is empty for upload", async () => {
    await expect(
      node.execute({}, baseConfig({ key: "" }), makeCtx())
    ).rejects.toMatchObject({ code: "STORAGE_MISSING_KEY" });
  });

  it("throws STORAGE_MISSING_CREDENTIAL when credentialId missing for s3", async () => {
    const nodeWithVault = new FileStorageNode(makeVault(), () => mockProvider);
    await expect(
      nodeWithVault.execute({}, baseConfig({ credentialId: undefined }), makeCtx())
    ).rejects.toMatchObject({ code: "STORAGE_MISSING_CREDENTIAL" });
  });

  it("throws STORAGE_NO_VAULT when vault not configured for cloud provider", async () => {
    const nodeNoVault = new FileStorageNode(undefined, () => mockProvider);
    await expect(
      nodeNoVault.execute({}, baseConfig(), makeCtx())
    ).rejects.toMatchObject({ code: "STORAGE_NO_VAULT" });
  });

  // ── Upload ────────────────────────────────────────────────────────────────────

  it("upload: calls provider.upload with correct key and utf8 content", async () => {
    const out = await node.execute(
      {},
      baseConfig({ content: "hello", contentEncoding: "utf8", contentType: "text/plain" }),
      makeCtx()
    );

    expect(mockProvider.upload).toHaveBeenCalledWith(
      "reports/file.txt",
      Buffer.from("hello", "utf8"),
      { contentType: "text/plain" }
    );
    expect((out.data as Record<string, unknown>)["operation"]).toBe("upload");
    expect((out.data as Record<string, unknown>)["key"]).toBe("reports/file.txt");
  });

  it("upload: decodes base64 content to Buffer", async () => {
    const original = "binary data";
    const b64 = Buffer.from(original).toString("base64");

    await node.execute(
      {},
      baseConfig({ content: b64, contentEncoding: "base64" }),
      makeCtx()
    );

    const uploadCall = (mockProvider.upload as ReturnType<typeof jest.fn>).mock.calls[0] as [string, Buffer, Record<string, unknown>];
    expect(uploadCall[1].toString("utf8")).toBe(original);
  });

  it("upload: throws STORAGE_SIZE_EXCEEDED when content exceeds 100MB", async () => {
    const hugeContent = "x".repeat(101 * 1024 * 1024);
    await expect(
      node.execute({}, baseConfig({ content: hugeContent }), makeCtx())
    ).rejects.toMatchObject({ code: "STORAGE_SIZE_EXCEEDED" });
  });

  // ── Download ──────────────────────────────────────────────────────────────────

  it("download: returns utf8 string content by default", async () => {
    const out = await node.execute(
      {},
      baseConfig({ operation: "download" }),
      makeCtx()
    );
    expect((out.data as Record<string, unknown>)["content"]).toBe("hello world");
    expect((out.data as Record<string, unknown>)["operation"]).toBe("download");
  });

  it("download: returns base64 string when contentEncoding=base64", async () => {
    const out = await node.execute(
      {},
      baseConfig({ operation: "download", contentEncoding: "base64" }),
      makeCtx()
    );
    expect((out.data as Record<string, unknown>)["content"]).toBe(
      Buffer.from("hello world").toString("base64")
    );
  });

  // ── Delete ────────────────────────────────────────────────────────────────────

  it("delete: calls provider.delete with correct key", async () => {
    const out = await node.execute({}, baseConfig({ operation: "delete" }), makeCtx());
    expect(mockProvider.delete).toHaveBeenCalledWith("reports/file.txt");
    expect((out.data as Record<string, unknown>)["success"]).toBe(true);
  });

  // ── List ──────────────────────────────────────────────────────────────────────

  it("list: calls provider.list with prefix and maxKeys", async () => {
    const out = await node.execute(
      {},
      baseConfig({ operation: "list", listPrefix: "reports/", maxKeys: 50, key: undefined }),
      makeCtx()
    );

    expect(mockProvider.list).toHaveBeenCalledWith("reports/", 50);
    const data = out.data as Record<string, unknown>;
    expect(data["count"]).toBe(1);
    expect(Array.isArray(data["items"])).toBe(true);
  });

  // ── Signed URL ────────────────────────────────────────────────────────────────

  it("signedUrl: calls provider.getSignedUrl with key and expiresIn", async () => {
    const out = await node.execute(
      {},
      baseConfig({ operation: "signedUrl", signedUrlExpiresIn: 7200 }),
      makeCtx()
    );

    expect(mockProvider.getSignedUrl).toHaveBeenCalledWith("reports/file.txt", 7200);
    const data = out.data as Record<string, unknown>;
    expect(data["expiresIn"]).toBe(7200);
    expect(typeof data["url"]).toBe("string");
  });

  // ── Metadata ──────────────────────────────────────────────────────────────────

  it("metadata: returns size, contentType and lastModified", async () => {
    const out = await node.execute(
      {},
      baseConfig({ operation: "metadata" }),
      makeCtx()
    );
    const data = out.data as Record<string, unknown>;
    expect(data["size"]).toBe(11);
    expect(data["contentType"]).toBe("text/plain");
    expect(typeof data["lastModified"]).toBe("string");
  });
});

// ─── LocalProvider tests ──────────────────────────────────────────────────────

describe("LocalProvider", () => {
  let tmpDir: string;
  let provider: LocalProvider;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "storage-test-"));
    provider = new LocalProvider(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("upload and download roundtrip preserves content", async () => {
    const content = Buffer.from("Hello, storage!");
    await provider.upload("subdir/file.txt", content, { contentType: "text/plain" });

    const result = await provider.download("subdir/file.txt");
    expect(result.content.toString("utf8")).toBe("Hello, storage!");
    expect(result.size).toBe(content.length);
  });

  it("upload returns correct key, size, and url", async () => {
    const result = await provider.upload("test.txt", Buffer.from("data"), { contentType: "text/plain" });
    expect(result.key).toBe("test.txt");
    expect(result.size).toBe(4);
    expect(result.url).toMatch(/^file:\/\//);
    expect(result.contentType).toBe("text/plain");
  });

  it("download throws STORAGE_NOT_FOUND for missing file", async () => {
    await expect(provider.download("nonexistent.txt")).rejects.toMatchObject({
      code: "STORAGE_NOT_FOUND",
    });
  });

  it("delete removes the file", async () => {
    await provider.upload("to-delete.txt", Buffer.from("bye"));
    await provider.delete("to-delete.txt");
    await expect(provider.download("to-delete.txt")).rejects.toMatchObject({
      code: "STORAGE_NOT_FOUND",
    });
  });

  it("delete throws STORAGE_NOT_FOUND when file does not exist", async () => {
    await expect(provider.delete("ghost.txt")).rejects.toMatchObject({
      code: "STORAGE_NOT_FOUND",
    });
  });

  it("list returns uploaded files", async () => {
    await provider.upload("a/file1.txt", Buffer.from("1"));
    await provider.upload("a/file2.txt", Buffer.from("22"));

    const items = await provider.list("a", 100);
    const keys = items.map((i) => i.key.replace(/\\/g, "/"));
    expect(keys).toContain("a/file1.txt");
    expect(keys).toContain("a/file2.txt");
  });

  it("list respects maxKeys limit", async () => {
    await provider.upload("f1.txt", Buffer.from("1"));
    await provider.upload("f2.txt", Buffer.from("2"));
    await provider.upload("f3.txt", Buffer.from("3"));

    const items = await provider.list("", 2);
    expect(items.length).toBeLessThanOrEqual(2);
  });

  it("getMetadata returns correct size and lastModified", async () => {
    await provider.upload("meta.txt", Buffer.from("test content"));
    const meta = await provider.getMetadata("meta.txt");
    expect(meta.size).toBe(12);
    expect(typeof meta.lastModified.toISOString()).toBe("string");
  });

  // ── Path traversal ────────────────────────────────────────────────────────────

  it("throws STORAGE_INVALID_KEY for path traversal via ../", async () => {
    await expect(provider.upload("../escape.txt", Buffer.from("x"))).rejects.toMatchObject({
      code: "STORAGE_INVALID_KEY",
    });
  });

  it("throws STORAGE_INVALID_KEY for path traversal in nested key", async () => {
    await expect(provider.download("subdir/../../etc/passwd")).rejects.toMatchObject({
      code: "STORAGE_INVALID_KEY",
    });
  });

  it("throws STORAGE_INVALID_KEY for absolute path", async () => {
    await expect(provider.delete("/etc/passwd")).rejects.toMatchObject({
      code: "STORAGE_INVALID_KEY",
    });
  });

  it("throws STORAGE_SIZE_EXCEEDED for content over 100MB", async () => {
    const huge = Buffer.alloc(101 * 1024 * 1024);
    await expect(provider.upload("big.bin", huge)).rejects.toMatchObject({
      code: "STORAGE_SIZE_EXCEEDED",
    });
  });
});
