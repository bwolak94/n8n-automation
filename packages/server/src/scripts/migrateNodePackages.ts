/**
 * Migrate existing marketplace node packages:
 *   - Set isBuiltIn: true for packages whose nodeType is implemented server-side
 *   - Fix nodeType values that were seeded with wrong types
 *
 * Idempotent. Safe to re-run.
 *
 * Usage:
 *   pnpm --filter server migrate:node-packages
 */

import { connectMongoDB } from "../config/database.js";
import { MarketplacePackageModel } from "../modules/marketplace/MarketplacePackage.model.js";

// ─── Mapping: packageName → { isBuiltIn, correctedNodeType? } ────────────────
//
// nodeTypes that match a registered INode implementation → isBuiltIn: true
// Everything else stays isBuiltIn: false (shown as "Coming Soon" in the UI)

const BUILT_IN_MAP: Record<string, string> = {
  // Already have implementations in nodes/implementations/
  "slack":           "slack",
  "telegram":        "telegram",
  "discord":         "discord",
  "openai":          "openai",
  "github":          "github",
  // Map to existing built-in types
  "anthropic-claude": "ai_transform",
  "webhook-trigger":  "webhook",
  "postgres":         "db_query",
  "rss-feed":         "http",   // RSS is just HTTP + JS parsing; use http node type
};

async function main(): Promise<void> {
  await connectMongoDB();

  const all = await MarketplacePackageModel.find({}).lean();
  console.log(`Found ${all.length} marketplace packages`);

  let builtInCount = 0;
  let comingSoonCount = 0;

  for (const pkg of all) {
    const correctedType = BUILT_IN_MAP[pkg.nodeType];
    const isBuiltIn = correctedType !== undefined;

    const update: Record<string, unknown> = { isBuiltIn };
    if (correctedType && correctedType !== pkg.nodeType) {
      update["nodeType"] = correctedType;
      console.log(`  Updating nodeType: ${pkg.name}  ${pkg.nodeType} → ${correctedType}`);
    }

    await MarketplacePackageModel.updateOne({ packageId: pkg.packageId }, { $set: update });

    if (isBuiltIn) {
      builtInCount++;
      console.log(`  [built-in]     ${pkg.name} (${correctedType})`);
    } else {
      comingSoonCount++;
      console.log(`  [coming-soon]  ${pkg.name}`);
    }
  }

  console.log(`\nDone — ${builtInCount} built-in, ${comingSoonCount} coming soon.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
