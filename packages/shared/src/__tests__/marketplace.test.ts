import { expectTypeOf } from "expect-type";
import {
  MarketplacePackageSchema,
  InstalledNodeSchema,
  InstallNodeSchema,
} from "../schemas/marketplace.js";
import { NodeCategory } from "../constants/index.js";
import type { MarketplacePackage, InstalledNode } from "../types/index.js";

const validPackage = {
  id: "pkg-1",
  name: "Slack Connector",
  description: "Send messages to Slack",
  version: "1.2.3",
  author: "Acme",
  category: NodeCategory.COMMUNICATION,
  tags: ["slack", "messaging"],
  downloadCount: 500,
  publishedAt: new Date(),
  updatedAt: new Date(),
};

const validInstalledNode = {
  id: "installed-1",
  tenantId: "tenant-1",
  packageId: "pkg-1",
  packageName: "Slack Connector",
  version: "1.2.3",
  installedAt: new Date(),
  installedBy: "user-1",
};

describe("MarketplacePackageSchema", () => {
  it("parses valid package", () => {
    expect(MarketplacePackageSchema.safeParse(validPackage).success).toBe(true);
  });

  it("rejects invalid semver version", () => {
    const result = MarketplacePackageSchema.safeParse({ ...validPackage, version: "1.0" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("version");
  });

  it("rejects invalid category", () => {
    const result = MarketplacePackageSchema.safeParse({ ...validPackage, category: "invalid" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid repositoryUrl", () => {
    const result = MarketplacePackageSchema.safeParse({
      ...validPackage,
      repositoryUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional fields absent", () => {
    const { rating, repositoryUrl, iconUrl, ...rest } = validPackage as typeof validPackage & {
      rating?: number;
      repositoryUrl?: string;
      iconUrl?: string;
    };
    const result = MarketplacePackageSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it("rejects rating > 5", () => {
    const result = MarketplacePackageSchema.safeParse({ ...validPackage, rating: 5.1 });
    expect(result.success).toBe(false);
  });

  it("inferred MarketplacePackage type has correct shape", () => {
    expectTypeOf<MarketplacePackage>().toHaveProperty("id");
    expectTypeOf<MarketplacePackage>().toHaveProperty("version");
    expectTypeOf<MarketplacePackage>().toHaveProperty("category");
  });
});

describe("InstalledNodeSchema", () => {
  it("parses valid installed node", () => {
    expect(InstalledNodeSchema.safeParse(validInstalledNode).success).toBe(true);
  });

  it("rejects missing tenantId", () => {
    const { tenantId, ...rest } = validInstalledNode;
    const result = InstalledNodeSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("inferred InstalledNode type has correct shape", () => {
    expectTypeOf<InstalledNode>().toHaveProperty("tenantId");
    expectTypeOf<InstalledNode>().toHaveProperty("packageId");
  });
});

describe("InstallNodeSchema", () => {
  it("parses valid install request", () => {
    expect(InstallNodeSchema.safeParse({ packageId: "pkg-1" }).success).toBe(true);
  });

  it("rejects empty packageId", () => {
    const result = InstallNodeSchema.safeParse({ packageId: "" });
    expect(result.success).toBe(false);
  });
});
