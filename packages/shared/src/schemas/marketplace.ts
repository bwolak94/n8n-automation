import { z } from "zod";
import { NodeCategory } from "../constants/index.js";

export const MarketplacePackageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255),
  description: z.string().max(2000),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "Version must follow semver (e.g. 1.0.0)"),
  author: z.string().min(1).max(255),
  category: z.nativeEnum(NodeCategory),
  tags: z.array(z.string()).default([]),
  downloadCount: z.number().int().min(0).default(0),
  rating: z.number().min(0).max(5).optional(),
  repositoryUrl: z.string().url().optional(),
  iconUrl: z.string().url().optional(),
  publishedAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const InstalledNodeSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  packageId: z.string().min(1),
  packageName: z.string().min(1),
  version: z.string().min(1),
  installedAt: z.coerce.date(),
  installedBy: z.string().min(1),
});

export const InstallNodeSchema = z.object({
  packageId: z.string().min(1),
});
