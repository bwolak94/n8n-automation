import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { TemplateModel } from "../modules/templates/Template.model.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, "templates");

interface SeedTemplateFile {
  name: string;
  category: string;
  description: string;
  author: string;
  tags?: string[];
  nodes: unknown[];
  edges: unknown[];
}

export async function seedTemplates(): Promise<void> {
  const files = readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith(".json"));

  let seeded = 0;
  let skipped = 0;

  for (const file of files) {
    const raw = readFileSync(join(TEMPLATES_DIR, file), "utf-8");
    const data = JSON.parse(raw) as SeedTemplateFile;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await ((TemplateModel as any).findOne({
      name: data.name,
      tenantId: null,
    }) as Promise<unknown>);

    if (existing) {
      skipped++;
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (TemplateModel as any).create({
      name:        data.name,
      category:    data.category,
      description: data.description,
      author:      data.author ?? "platform",
      tags:        data.tags ?? [],
      nodes:       data.nodes ?? [],
      edges:       data.edges ?? [],
      isPublic:    true,
      tenantId:    null,
      usageCount:  0,
      rating:      0,
    });

    console.log(`[seedTemplates] seeded: ${data.name}`);
    seeded++;
  }

  console.log(
    `[seedTemplates] done — ${seeded} seeded, ${skipped} already existed (${files.length} total files)`
  );
}
