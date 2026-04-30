/**
 * Seed script — populates the marketplace with built-in integration packages.
 * Run once:  pnpm --filter server tsx src/scripts/seedMarketplace.ts
 */

import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

// ─── Inline model (avoid env bootstrap) ──────────────────────────────────────

const schema = new mongoose.Schema(
  {
    packageId:   { type: String, required: true, unique: true },
    name:        { type: String, required: true },
    version:     { type: String, required: true },
    description: { type: String, default: "" },
    author:      { type: String, required: true },
    nodeType:    { type: String, required: true, unique: true },
    category:    { type: String, default: "integrations" },
    tags:        [String],
    permissions: [String],
    status:      { type: String, default: "approved" },
    publisherId: { type: String, required: true },
    downloads:   { type: Number, default: 0 },
    rating:      { type: Number, default: 0 },
    tarballPath: { type: String, default: "" },
  },
  { timestamps: true, collection: "marketplacepackages" }
);

const PackageModel =
  (mongoose.models["MarketplacePackage"] as mongoose.Model<unknown>) ??
  mongoose.model("MarketplacePackage", schema);

// ─── Package definitions ──────────────────────────────────────────────────────

interface PackageSeed {
  name: string;
  version: string;
  description: string;
  author: string;
  nodeType: string;
  category: string;
  tags: string[];
  permissions: string[];
  downloads: number;
  rating: number;
}

const PACKAGES: PackageSeed[] = [
  // ── Communication ────────────────────────────────────────────────────────
  {
    name: "Slack",
    version: "2.1.0",
    description: "Send messages, create channels, manage users and files in Slack workspaces.",
    author: "Automation Hub",
    nodeType: "slack",
    category: "communication",
    tags: ["slack", "messaging", "team", "notifications"],
    permissions: ["http", "credentials"],
    downloads: 48320,
    rating: 4.8,
  },
  {
    name: "Gmail",
    version: "2.0.1",
    description: "Send and receive emails, manage labels, drafts and attachments via Gmail API.",
    author: "Automation Hub",
    nodeType: "gmail",
    category: "communication",
    tags: ["email", "gmail", "google", "messages"],
    permissions: ["http", "credentials"],
    downloads: 41150,
    rating: 4.7,
  },
  {
    name: "Telegram",
    version: "1.4.0",
    description: "Send messages, photos and files to Telegram chats, groups and channels.",
    author: "Automation Hub",
    nodeType: "telegram",
    category: "communication",
    tags: ["telegram", "messaging", "bot", "notifications"],
    permissions: ["http", "credentials"],
    downloads: 29870,
    rating: 4.6,
  },
  {
    name: "Discord",
    version: "1.3.2",
    description: "Post messages to Discord channels, manage roles and react to events via webhooks.",
    author: "Automation Hub",
    nodeType: "discord",
    category: "communication",
    tags: ["discord", "messaging", "gaming", "community"],
    permissions: ["http", "credentials"],
    downloads: 22100,
    rating: 4.5,
  },
  {
    name: "Twilio SMS",
    version: "1.2.0",
    description: "Send SMS, MMS, and WhatsApp messages programmatically using Twilio.",
    author: "Automation Hub",
    nodeType: "twilio-sms",
    category: "communication",
    tags: ["sms", "twilio", "phone", "whatsapp"],
    permissions: ["http", "credentials"],
    downloads: 15640,
    rating: 4.4,
  },
  {
    name: "Microsoft Teams",
    version: "1.5.0",
    description: "Post messages to Teams channels, create meetings and manage team members.",
    author: "Automation Hub",
    nodeType: "microsoft-teams",
    category: "communication",
    tags: ["teams", "microsoft", "meetings", "enterprise"],
    permissions: ["http", "credentials"],
    downloads: 18900,
    rating: 4.3,
  },

  // ── Productivity ─────────────────────────────────────────────────────────
  {
    name: "Google Sheets",
    version: "3.0.0",
    description: "Read, write, append and update rows in Google Sheets spreadsheets.",
    author: "Automation Hub",
    nodeType: "google-sheets",
    category: "productivity",
    tags: ["google", "sheets", "spreadsheet", "data"],
    permissions: ["http", "credentials"],
    downloads: 52400,
    rating: 4.9,
  },
  {
    name: "Notion",
    version: "2.2.0",
    description: "Create pages, update databases, query blocks and manage Notion workspaces.",
    author: "Automation Hub",
    nodeType: "notion",
    category: "productivity",
    tags: ["notion", "notes", "database", "knowledge"],
    permissions: ["http", "credentials"],
    downloads: 33210,
    rating: 4.7,
  },
  {
    name: "Airtable",
    version: "2.1.0",
    description: "Create, read, update and delete records in Airtable bases and tables.",
    author: "Automation Hub",
    nodeType: "airtable",
    category: "productivity",
    tags: ["airtable", "database", "spreadsheet", "crm"],
    permissions: ["http", "credentials"],
    downloads: 27800,
    rating: 4.6,
  },
  {
    name: "Trello",
    version: "1.3.0",
    description: "Manage Trello boards, lists and cards. Move cards, add members and attachments.",
    author: "Automation Hub",
    nodeType: "trello",
    category: "productivity",
    tags: ["trello", "kanban", "tasks", "project-management"],
    permissions: ["http", "credentials"],
    downloads: 19500,
    rating: 4.4,
  },
  {
    name: "Jira",
    version: "2.0.0",
    description: "Create and update issues, manage sprints and projects in Jira Software.",
    author: "Automation Hub",
    nodeType: "jira",
    category: "productivity",
    tags: ["jira", "atlassian", "issues", "agile"],
    permissions: ["http", "credentials"],
    downloads: 24600,
    rating: 4.5,
  },
  {
    name: "GitHub",
    version: "1.6.0",
    description: "Manage repos, issues, pull requests, releases and GitHub Actions workflows.",
    author: "Automation Hub",
    nodeType: "github",
    category: "productivity",
    tags: ["github", "git", "code", "devops"],
    permissions: ["http", "credentials"],
    downloads: 31200,
    rating: 4.8,
  },

  // ── CRM & Sales ──────────────────────────────────────────────────────────
  {
    name: "HubSpot",
    version: "2.3.0",
    description: "Create contacts, deals, companies and tasks. Sync CRM data with your workflows.",
    author: "Automation Hub",
    nodeType: "hubspot",
    category: "crm",
    tags: ["hubspot", "crm", "sales", "marketing"],
    permissions: ["http", "credentials"],
    downloads: 21300,
    rating: 4.6,
  },
  {
    name: "Salesforce",
    version: "2.0.1",
    description: "Query and mutate Salesforce objects — leads, accounts, opportunities and more.",
    author: "Automation Hub",
    nodeType: "salesforce",
    category: "crm",
    tags: ["salesforce", "crm", "enterprise", "sales"],
    permissions: ["http", "credentials"],
    downloads: 17800,
    rating: 4.4,
  },
  {
    name: "Stripe",
    version: "1.8.0",
    description: "Create charges, manage subscriptions, handle webhooks and query Stripe data.",
    author: "Automation Hub",
    nodeType: "stripe",
    category: "crm",
    tags: ["stripe", "payments", "billing", "subscriptions"],
    permissions: ["http", "credentials"],
    downloads: 23400,
    rating: 4.7,
  },

  // ── Databases ────────────────────────────────────────────────────────────
  {
    name: "PostgreSQL",
    version: "2.0.0",
    description: "Execute queries, insert, update and delete rows in PostgreSQL databases.",
    author: "Automation Hub",
    nodeType: "postgres",
    category: "databases",
    tags: ["postgres", "sql", "database", "rdbms"],
    permissions: ["credentials"],
    downloads: 38900,
    rating: 4.8,
  },
  {
    name: "MySQL",
    version: "1.5.0",
    description: "Run SQL queries and manage data in MySQL and MariaDB databases.",
    author: "Automation Hub",
    nodeType: "mysql",
    category: "databases",
    tags: ["mysql", "sql", "database", "mariadb"],
    permissions: ["credentials"],
    downloads: 29400,
    rating: 4.6,
  },
  {
    name: "MongoDB",
    version: "1.4.0",
    description: "Find, insert, update and delete documents in MongoDB collections.",
    author: "Automation Hub",
    nodeType: "mongodb",
    category: "databases",
    tags: ["mongodb", "nosql", "database", "documents"],
    permissions: ["credentials"],
    downloads: 25100,
    rating: 4.5,
  },
  {
    name: "Redis",
    version: "1.2.0",
    description: "Get, set, delete keys and publish/subscribe to Redis channels.",
    author: "Automation Hub",
    nodeType: "redis",
    category: "databases",
    tags: ["redis", "cache", "pubsub", "queue"],
    permissions: ["credentials"],
    downloads: 16200,
    rating: 4.4,
  },

  // ── Cloud & Storage ──────────────────────────────────────────────────────
  {
    name: "AWS S3",
    version: "2.1.0",
    description: "Upload, download, list and delete objects in Amazon S3 buckets.",
    author: "Automation Hub",
    nodeType: "aws-s3",
    category: "cloud",
    tags: ["aws", "s3", "storage", "files"],
    permissions: ["http", "credentials"],
    downloads: 28700,
    rating: 4.7,
  },
  {
    name: "Google Drive",
    version: "2.0.0",
    description: "Upload, download, share and manage files and folders in Google Drive.",
    author: "Automation Hub",
    nodeType: "google-drive",
    category: "cloud",
    tags: ["google", "drive", "storage", "files"],
    permissions: ["http", "credentials"],
    downloads: 24500,
    rating: 4.6,
  },
  {
    name: "Dropbox",
    version: "1.3.0",
    description: "Upload and download files, create folders and manage sharing in Dropbox.",
    author: "Automation Hub",
    nodeType: "dropbox",
    category: "cloud",
    tags: ["dropbox", "storage", "files", "sharing"],
    permissions: ["http", "credentials"],
    downloads: 14300,
    rating: 4.3,
  },

  // ── AI & Data ────────────────────────────────────────────────────────────
  {
    name: "OpenAI",
    version: "2.5.0",
    description: "Generate text, images, embeddings and run chat completions with OpenAI models.",
    author: "Automation Hub",
    nodeType: "openai",
    category: "ai",
    tags: ["openai", "gpt", "ai", "llm", "embeddings"],
    permissions: ["http", "credentials"],
    downloads: 61200,
    rating: 4.9,
  },
  {
    name: "Anthropic Claude",
    version: "1.2.0",
    description: "Generate text, analyze documents and run multi-turn conversations with Claude.",
    author: "Automation Hub",
    nodeType: "anthropic-claude",
    category: "ai",
    tags: ["claude", "anthropic", "ai", "llm"],
    permissions: ["http", "credentials"],
    downloads: 34100,
    rating: 4.8,
  },
  {
    name: "RSS Feed",
    version: "1.1.0",
    description: "Fetch and parse RSS and Atom feeds. Trigger workflows on new articles.",
    author: "Automation Hub",
    nodeType: "rss-feed",
    category: "integrations",
    tags: ["rss", "feed", "news", "blog"],
    permissions: ["http"],
    downloads: 11400,
    rating: 4.2,
  },
  {
    name: "Webhook Trigger",
    version: "1.0.0",
    description: "Start a workflow when an incoming HTTP webhook is received from any service.",
    author: "Automation Hub",
    nodeType: "webhook-trigger",
    category: "integrations",
    tags: ["webhook", "trigger", "http", "events"],
    permissions: ["http"],
    downloads: 55800,
    rating: 4.9,
  },
  {
    name: "Google Calendar",
    version: "1.4.0",
    description: "Create, update and delete events. Check availability and manage calendars.",
    author: "Automation Hub",
    nodeType: "google-calendar",
    category: "productivity",
    tags: ["google", "calendar", "events", "scheduling"],
    permissions: ["http", "credentials"],
    downloads: 20100,
    rating: 4.5,
  },
  {
    name: "Mailchimp",
    version: "1.3.0",
    description: "Manage subscribers, campaigns and automations in Mailchimp email marketing.",
    author: "Automation Hub",
    nodeType: "mailchimp",
    category: "communication",
    tags: ["mailchimp", "email", "marketing", "newsletter"],
    permissions: ["http", "credentials"],
    downloads: 13700,
    rating: 4.3,
  },
  {
    name: "Zendesk",
    version: "1.2.0",
    description: "Create and update tickets, manage users and track support activity in Zendesk.",
    author: "Automation Hub",
    nodeType: "zendesk",
    category: "crm",
    tags: ["zendesk", "support", "tickets", "helpdesk"],
    permissions: ["http", "credentials"],
    downloads: 12900,
    rating: 4.3,
  },
  {
    name: "Linear",
    version: "1.1.0",
    description: "Create issues, update projects and sync engineering work in Linear.",
    author: "Automation Hub",
    nodeType: "linear",
    category: "productivity",
    tags: ["linear", "issues", "engineering", "project-management"],
    permissions: ["http", "credentials"],
    downloads: 9800,
    rating: 4.4,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  const mongoUrl = process.env["MONGODB_URI"] ?? "mongodb://localhost:27018/automation-hub";
  console.log(`Connecting to ${mongoUrl} …`);
  await mongoose.connect(mongoUrl);
  console.log("Connected.");

  let inserted = 0;
  let skipped = 0;

  for (const pkg of PACKAGES) {
    const exists = await PackageModel.findOne({ nodeType: pkg.nodeType }).lean();
    if (exists) {
      skipped++;
      continue;
    }
    await PackageModel.create({
      packageId:   randomUUID(),
      publisherId: "automation-hub",
      status:      "approved",
      tarballPath: "",
      ...pkg,
    });
    inserted++;
    console.log(`  ✓ ${pkg.name}`);
  }

  console.log(`\nDone — ${inserted} inserted, ${skipped} skipped.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
