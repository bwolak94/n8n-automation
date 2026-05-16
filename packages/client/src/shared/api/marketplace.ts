import { apiClient } from "./client.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarketplacePackage {
  packageId: string;
  name: string;
  version: string;
  description: string;
  author: string;
  nodeType: string;
  category: string;
  tags: string[];
  permissions: string[];
  status: string;
  publisherId: string;
  /** Ships with the server — can be installed without an uploaded tarball */
  isBuiltIn: boolean;
  downloads: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export interface InstalledNode {
  tenantId: string;
  packageId: string;
  nodeType: string;
  version: string;
  installedAt: string;
}

export interface ListPackagesQuery {
  search?: string;
  category?: string;
  sort?: "downloads" | "rating" | "newest";
  limit?: number;
  offset?: number;
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function listMarketplacePackages(
  query: ListPackagesQuery = {}
): Promise<{ items: MarketplacePackage[]; total: number }> {
  const params = new URLSearchParams();
  if (query.search)   params.set("search", query.search);
  if (query.category) params.set("category", query.category);
  if (query.sort)     params.set("sort", query.sort);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  const qs = params.toString();
  return apiClient.get(`marketplace/nodes${qs ? `?${qs}` : ""}`).json();
}

export async function installPackage(packageId: string): Promise<InstalledNode> {
  return apiClient.post(`marketplace/nodes/${packageId}/install`).json();
}

export async function uninstallPackage(packageId: string): Promise<void> {
  await apiClient.delete(`marketplace/nodes/${packageId}/install`);
}

export async function listInstalledNodes(): Promise<{ items: InstalledNode[] }> {
  return apiClient.get("marketplace/installed").json();
}
