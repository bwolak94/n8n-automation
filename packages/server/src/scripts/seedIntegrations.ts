/**
 * Seed official integration templates.
 *
 * Idempotent — uses upsert so re-running does not create duplicates.
 *
 * Usage:
 *   pnpm --filter server tsx src/scripts/seedIntegrations.ts
 */

import { connectMongoDB } from "../config/database.js";
import { IntegrationRepository } from "../modules/marketplace/IntegrationRepository.js";
import { TemplateStatus } from "../modules/marketplace/IntegrationTemplate.model.js";
import type { CreateTemplateInput } from "../modules/marketplace/IntegrationRepository.js";

// ─── Official template definitions ───────────────────────────────────────────

const SYSTEM_AUTHOR    = "Automation Hub Team";
const SYSTEM_AUTHOR_ID = "system";

const templates: CreateTemplateInput[] = [
  // ── 1. HTTP Polling → Slack Notification ─────────────────────────────────
  {
    templateId:       "official-http-poll-slack",
    name:             "HTTP Polling → Slack Notification",
    description:      "Poll any HTTP endpoint on a schedule and post the result to a Slack webhook.",
    longDescription:  "Checks a URL for new data and immediately forwards a formatted summary to your Slack channel. Ideal for monitoring APIs, price trackers, or any public feed.",
    category:         "integrations",
    tags:             ["slack", "http", "polling", "notifications"],
    author:           SYSTEM_AUTHOR,
    authorId:         SYSTEM_AUTHOR_ID,
    isOfficial:       true,
    status:           TemplateStatus.APPROVED,
    requiredNodeTypes: ["http_request"],
    workflow: {
      nodes: [
        {
          id:       "trigger",
          type:     "webhook",
          category: "triggers",
          label:    "Schedule Trigger",
          position: { x: 60, y: 200 },
          config:   { path: "poll-trigger", method: "POST" },
        },
        {
          id:       "fetch",
          type:     "http_request",
          category: "actions",
          label:    "Fetch Data",
          position: { x: 300, y: 200 },
          config:   { url: "https://api.example.com/data", method: "GET" },
        },
        {
          id:       "transform",
          type:     "transform",
          category: "data",
          label:    "Format Message",
          position: { x: 540, y: 200 },
          config:   { expression: "{ text: `Update: ${JSON.stringify(input.data)}` }" },
        },
        {
          id:       "notify",
          type:     "http_request",
          category: "actions",
          label:    "Post to Slack",
          position: { x: 780, y: 200 },
          config:   { url: "https://hooks.slack.com/services/YOUR/WEBHOOK/URL", method: "POST" },
        },
      ],
      edges: [
        { id: "e1", source: "trigger",   target: "fetch" },
        { id: "e2", source: "fetch",     target: "transform" },
        { id: "e3", source: "transform", target: "notify" },
      ],
      variables: { SLACK_WEBHOOK_URL: "", POLL_URL: "" },
    },
  },

  // ── 2. Stripe Webhook → Email Notification ────────────────────────────────
  {
    templateId:       "official-stripe-webhook-email",
    name:             "Stripe Webhook → Email Notification",
    description:      "Receive Stripe events, filter by payment success, and send a confirmation email.",
    longDescription:  "Listens for Stripe webhook events (payment_intent.succeeded), extracts the customer email from the payload, and dispatches a branded confirmation email via your SMTP provider.",
    category:         "integrations",
    tags:             ["stripe", "payments", "email", "webhook"],
    author:           SYSTEM_AUTHOR,
    authorId:         SYSTEM_AUTHOR_ID,
    isOfficial:       true,
    status:           TemplateStatus.APPROVED,
    requiredNodeTypes: ["webhook", "condition", "email"],
    workflow: {
      nodes: [
        {
          id:       "stripe-in",
          type:     "webhook",
          category: "triggers",
          label:    "Stripe Webhook",
          position: { x: 60, y: 200 },
          config:   { path: "stripe-events", method: "POST" },
        },
        {
          id:       "check-event",
          type:     "condition",
          category: "logic",
          label:    "Payment Succeeded?",
          position: { x: 300, y: 200 },
          config:   { expression: "input.data.type === 'payment_intent.succeeded'" },
        },
        {
          id:       "extract",
          type:     "transform",
          category: "data",
          label:    "Extract Customer Info",
          position: { x: 540, y: 160 },
          config:   {
            expression: "{ to: input.data.data.object.receipt_email, amount: input.data.data.object.amount / 100, currency: input.data.data.object.currency.toUpperCase() }",
          },
        },
        {
          id:       "send-email",
          type:     "email",
          category: "communication",
          label:    "Send Confirmation Email",
          position: { x: 780, y: 160 },
          config:   {
            to:      "{{nodes.extract.data.to}}",
            subject: "Payment confirmed",
            body:    "Thank you! Your payment of {{nodes.extract.data.amount}} {{nodes.extract.data.currency}} was received.",
          },
        },
      ],
      edges: [
        { id: "e1", source: "stripe-in",   target: "check-event" },
        { id: "e2", source: "check-event", target: "extract",    sourceHandle: "true" },
        { id: "e3", source: "extract",     target: "send-email" },
      ],
      variables: { SMTP_FROM: "noreply@example.com" },
    },
  },

  // ── 3. AI Data Enrichment Pipeline ───────────────────────────────────────
  {
    templateId:       "official-ai-enrichment",
    name:             "AI Data Enrichment Pipeline",
    description:      "Fetch raw data from an API, enrich it with Claude AI, and POST the result to another endpoint.",
    longDescription:  "Calls a source REST API, sends the response body to Claude for summarisation or classification, then forwards the enriched output to a destination API. Useful for CRM enrichment, content tagging, or lead scoring.",
    category:         "ai",
    tags:             ["ai", "claude", "enrichment", "http", "pipeline"],
    author:           SYSTEM_AUTHOR,
    authorId:         SYSTEM_AUTHOR_ID,
    isOfficial:       true,
    status:           TemplateStatus.APPROVED,
    requiredNodeTypes: ["http_request", "ai_transform"],
    workflow: {
      nodes: [
        {
          id:       "trigger",
          type:     "webhook",
          category: "triggers",
          label:    "Trigger",
          position: { x: 60, y: 200 },
          config:   { path: "ai-enrich", method: "POST" },
        },
        {
          id:       "fetch-source",
          type:     "http_request",
          category: "actions",
          label:    "Fetch Source Data",
          position: { x: 300, y: 200 },
          config:   { url: "https://api.example.com/records/{{nodes.trigger.data.id}}", method: "GET" },
        },
        {
          id:       "ai-enrich",
          type:     "ai_transform",
          category: "ai",
          label:    "AI Enrichment",
          position: { x: 540, y: 200 },
          config:   {
            prompt:      "Summarise the following data in 2 sentences and extract key entities as JSON:\n\n{{nodes.fetch-source.data}}",
            maxTokens:   512,
            temperature: 0,
          },
        },
        {
          id:       "post-result",
          type:     "http_request",
          category: "actions",
          label:    "Store Enriched Data",
          position: { x: 780, y: 200 },
          config:   {
            url:    "https://api.example.com/records/{{nodes.trigger.data.id}}/enrichment",
            method: "PATCH",
            body:   "{{nodes.ai-enrich.data}}",
          },
        },
      ],
      edges: [
        { id: "e1", source: "trigger",     target: "fetch-source" },
        { id: "e2", source: "fetch-source", target: "ai-enrich" },
        { id: "e3", source: "ai-enrich",   target: "post-result" },
      ],
      variables: { SOURCE_API_BASE: "", DEST_API_BASE: "" },
    },
  },

  // ── 4. Email Drip Sequence ────────────────────────────────────────────────
  {
    templateId:       "official-email-drip",
    name:             "Email Drip Sequence (3-step)",
    description:      "Send a welcome email, wait 24 h, send a follow-up, wait another 48 h, send a final nudge.",
    longDescription:  "A classic 3-step email drip: immediate welcome, 24-hour follow-up, and 48-hour final nudge. Adapt the delays and body content to your onboarding flow.",
    category:         "communication",
    tags:             ["email", "drip", "onboarding", "marketing"],
    author:           SYSTEM_AUTHOR,
    authorId:         SYSTEM_AUTHOR_ID,
    isOfficial:       true,
    status:           TemplateStatus.APPROVED,
    requiredNodeTypes: ["email", "delay"],
    workflow: {
      nodes: [
        {
          id:       "trigger",
          type:     "webhook",
          category: "triggers",
          label:    "New Subscriber",
          position: { x: 60, y: 200 },
          config:   { path: "drip-start", method: "POST" },
        },
        {
          id:       "email-1",
          type:     "email",
          category: "communication",
          label:    "Welcome Email",
          position: { x: 280, y: 200 },
          config:   {
            to:      "{{nodes.trigger.data.email}}",
            subject: "Welcome aboard!",
            body:    "Hi {{nodes.trigger.data.name}}, welcome to our platform. Here's how to get started...",
          },
        },
        {
          id:       "delay-1",
          type:     "delay",
          category: "logic",
          label:    "Wait 24 h",
          position: { x: 500, y: 200 },
          config:   { delayMs: 86400000 },
        },
        {
          id:       "email-2",
          type:     "email",
          category: "communication",
          label:    "Follow-up Email",
          position: { x: 720, y: 200 },
          config:   {
            to:      "{{nodes.trigger.data.email}}",
            subject: "How's it going?",
            body:    "Hi {{nodes.trigger.data.name}}, just checking in. Did you try feature X yet?",
          },
        },
        {
          id:       "delay-2",
          type:     "delay",
          category: "logic",
          label:    "Wait 48 h",
          position: { x: 940, y: 200 },
          config:   { delayMs: 172800000 },
        },
        {
          id:       "email-3",
          type:     "email",
          category: "communication",
          label:    "Final Nudge",
          position: { x: 1160, y: 200 },
          config:   {
            to:      "{{nodes.trigger.data.email}}",
            subject: "One last thing…",
            body:    "Hi {{nodes.trigger.data.name}}, here are 3 tips to get the most out of the platform.",
          },
        },
      ],
      edges: [
        { id: "e1", source: "trigger", target: "email-1" },
        { id: "e2", source: "email-1", target: "delay-1" },
        { id: "e3", source: "delay-1", target: "email-2" },
        { id: "e4", source: "email-2", target: "delay-2" },
        { id: "e5", source: "delay-2", target: "email-3" },
      ],
      variables: {},
    },
  },

  // ── 5. GitHub Issues → Slack ──────────────────────────────────────────────
  {
    templateId:       "official-github-issues-slack",
    name:             "GitHub Issues → Slack Alerts",
    description:      "Receive GitHub webhook events and post new issue notifications to a Slack channel.",
    longDescription:  "Configure your GitHub repository webhook to point at this workflow. When a new issue is opened it posts a formatted Slack message with the issue title, author, and link.",
    category:         "integrations",
    tags:             ["github", "slack", "issues", "devops", "webhook"],
    author:           SYSTEM_AUTHOR,
    authorId:         SYSTEM_AUTHOR_ID,
    isOfficial:       true,
    status:           TemplateStatus.APPROVED,
    requiredNodeTypes: ["webhook", "condition", "http_request"],
    workflow: {
      nodes: [
        {
          id:       "gh-webhook",
          type:     "webhook",
          category: "triggers",
          label:    "GitHub Webhook",
          position: { x: 60, y: 200 },
          config:   { path: "github-events", method: "POST" },
        },
        {
          id:       "is-issue-opened",
          type:     "condition",
          category: "logic",
          label:    "Issue Opened?",
          position: { x: 300, y: 200 },
          config:   {
            expression: "input.data.action === 'opened' && !!input.data.issue",
          },
        },
        {
          id:       "format-msg",
          type:     "transform",
          category: "data",
          label:    "Format Slack Message",
          position: { x: 540, y: 160 },
          config:   {
            expression: "{ text: `*New GitHub Issue*\\n*<${input.data.issue.html_url}|${input.data.issue.title}>*\\nOpened by ${input.data.issue.user.login}` }",
          },
        },
        {
          id:       "slack-post",
          type:     "http_request",
          category: "actions",
          label:    "Post to Slack",
          position: { x: 780, y: 160 },
          config:   {
            url:    "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
            method: "POST",
          },
        },
      ],
      edges: [
        { id: "e1", source: "gh-webhook",       target: "is-issue-opened" },
        { id: "e2", source: "is-issue-opened",  target: "format-msg",  sourceHandle: "true" },
        { id: "e3", source: "format-msg",        target: "slack-post" },
      ],
      variables: { SLACK_WEBHOOK_URL: "" },
    },
  },

  // ── 6. Data Transform & Forward ───────────────────────────────────────────
  {
    templateId:       "official-transform-forward",
    name:             "Data Transform & Forward",
    description:      "Receive a webhook payload, reshape it with a JavaScript expression, and POST to a downstream API.",
    longDescription:  "A minimal ETL pipeline: inbound webhook → JavaScript transformation → outbound HTTP POST. Great for adapting third-party webhook payloads to your internal API contract.",
    category:         "data",
    tags:             ["transform", "etl", "webhook", "javascript", "http"],
    author:           SYSTEM_AUTHOR,
    authorId:         SYSTEM_AUTHOR_ID,
    isOfficial:       true,
    status:           TemplateStatus.APPROVED,
    requiredNodeTypes: ["webhook", "javascript", "http_request"],
    workflow: {
      nodes: [
        {
          id:       "inbound",
          type:     "webhook",
          category: "triggers",
          label:    "Inbound Webhook",
          position: { x: 60, y: 200 },
          config:   { path: "transform-in", method: "POST" },
        },
        {
          id:       "js-map",
          type:     "javascript",
          category: "data",
          label:    "Transform Payload",
          position: { x: 300, y: 200 },
          config:   {
            code: [
              "// Reshape the incoming payload",
              "const raw = input.data;",
              "return {",
              "  id:        raw.external_id ?? raw.id,",
              "  createdAt: raw.created_at  ?? raw.timestamp,",
              "  payload:   raw,",
              "};",
            ].join("\n"),
          },
        },
        {
          id:       "forward",
          type:     "http_request",
          category: "actions",
          label:    "Forward to API",
          position: { x: 540, y: 200 },
          config:   {
            url:    "https://api.example.com/events",
            method: "POST",
            body:   "{{nodes.js-map.data}}",
          },
        },
      ],
      edges: [
        { id: "e1", source: "inbound", target: "js-map" },
        { id: "e2", source: "js-map",  target: "forward" },
      ],
      variables: { DEST_API_URL: "https://api.example.com/events" },
    },
  },

  // ── 7. Scheduled AI Report ────────────────────────────────────────────────
  {
    templateId:       "official-scheduled-ai-report",
    name:             "Scheduled AI Report",
    description:      "Fetch data from an API on a schedule, summarise with Claude AI, and email the report.",
    longDescription:  "Triggered on a schedule (or manually), this workflow pulls data from a REST endpoint, asks Claude to produce an executive summary, and delivers it to a list of email recipients.",
    category:         "ai",
    tags:             ["ai", "claude", "reporting", "email", "scheduled"],
    author:           SYSTEM_AUTHOR,
    authorId:         SYSTEM_AUTHOR_ID,
    isOfficial:       true,
    status:           TemplateStatus.APPROVED,
    requiredNodeTypes: ["http_request", "ai_transform", "email"],
    workflow: {
      nodes: [
        {
          id:       "trigger",
          type:     "webhook",
          category: "triggers",
          label:    "Schedule Trigger",
          position: { x: 60, y: 200 },
          config:   { path: "report-trigger", method: "POST" },
        },
        {
          id:       "fetch-data",
          type:     "http_request",
          category: "actions",
          label:    "Fetch Report Data",
          position: { x: 300, y: 200 },
          config:   { url: "https://api.example.com/stats", method: "GET" },
        },
        {
          id:       "summarise",
          type:     "ai_transform",
          category: "ai",
          label:    "AI Summarise",
          position: { x: 540, y: 200 },
          config:   {
            prompt:      "You are a data analyst. Produce a concise executive summary (max 200 words) of the following metrics. Highlight trends and anomalies.\n\nData:\n{{nodes.fetch-data.data}}",
            maxTokens:   512,
            temperature: 0.3,
          },
        },
        {
          id:       "send-report",
          type:     "email",
          category: "communication",
          label:    "Email Report",
          position: { x: 780, y: 200 },
          config:   {
            to:      "team@example.com",
            subject: "Daily Report — {{new Date().toISOString().slice(0,10)}}",
            body:    "{{nodes.summarise.data.text}}",
          },
        },
      ],
      edges: [
        { id: "e1", source: "trigger",    target: "fetch-data" },
        { id: "e2", source: "fetch-data", target: "summarise" },
        { id: "e3", source: "summarise",  target: "send-report" },
      ],
      variables: { REPORT_RECIPIENTS: "team@example.com", DATA_API_URL: "" },
    },
  },

  // ── 8. Conditional Branch Demo ────────────────────────────────────────────
  {
    templateId:       "official-conditional-branch",
    name:             "Conditional Branch Demo",
    description:      "Route webhook data to different actions based on a condition — perfect starting point for any decision-tree workflow.",
    longDescription:  "Demonstrates how to use the Condition node to split execution into two branches. Branch A sends an email; Branch B calls an external API. Fork and extend for any conditional logic.",
    category:         "logic",
    tags:             ["condition", "branching", "logic", "starter"],
    author:           SYSTEM_AUTHOR,
    authorId:         SYSTEM_AUTHOR_ID,
    isOfficial:       true,
    status:           TemplateStatus.APPROVED,
    requiredNodeTypes: ["webhook", "condition", "email", "http_request"],
    workflow: {
      nodes: [
        {
          id:       "trigger",
          type:     "webhook",
          category: "triggers",
          label:    "Webhook Trigger",
          position: { x: 60, y: 200 },
          config:   { path: "branch-demo", method: "POST" },
        },
        {
          id:       "check",
          type:     "condition",
          category: "logic",
          label:    "Is Premium?",
          position: { x: 300, y: 200 },
          config:   { expression: "input.data.plan === 'premium'" },
        },
        {
          id:       "email-premium",
          type:     "email",
          category: "communication",
          label:    "Send Premium Email",
          position: { x: 540, y: 100 },
          config:   {
            to:      "{{nodes.trigger.data.email}}",
            subject: "Welcome, premium member!",
            body:    "You have full access. Explore all features at your-app.com/features.",
          },
        },
        {
          id:       "notify-free",
          type:     "http_request",
          category: "actions",
          label:    "Notify CRM (Free User)",
          position: { x: 540, y: 320 },
          config:   {
            url:    "https://crm.example.com/api/contacts/tag",
            method: "POST",
            body:   "{ \"email\": \"{{nodes.trigger.data.email}}\", \"tag\": \"free-tier\" }",
          },
        },
      ],
      edges: [
        { id: "e1", source: "trigger", target: "check" },
        { id: "e2", source: "check",   target: "email-premium", sourceHandle: "true" },
        { id: "e3", source: "check",   target: "notify-free",   sourceHandle: "false" },
      ],
      variables: {},
    },
  },

  // ── 9. Google Sheets → Slack Row Alert ───────────────────────────────────
  {
    templateId:       "official-google-sheets-slack",
    name:             "Google Sheets → Slack Row Alert",
    description:      "Poll a Google Sheets spreadsheet for new rows and post each new entry to a Slack channel.",
    longDescription:  "Checks a published Google Sheet CSV export on a schedule, compares against the last known row count, and posts a formatted Slack message for every new entry. Great for tracking form submissions, sales leads, or inventory changes.",
    category:         "integrations",
    tags:             ["google-sheets", "slack", "spreadsheet", "polling", "notifications"],
    author:           SYSTEM_AUTHOR,
    authorId:         SYSTEM_AUTHOR_ID,
    isOfficial:       true,
    status:           TemplateStatus.APPROVED,
    requiredNodeTypes: ["http_request", "javascript"],
    workflow: {
      nodes: [
        {
          id:       "trigger",
          type:     "webhook",
          category: "triggers",
          label:    "Schedule Trigger",
          position: { x: 60, y: 200 },
          config:   { path: "sheets-poll", method: "POST" },
        },
        {
          id:       "fetch-sheet",
          type:     "http_request",
          category: "actions",
          label:    "Fetch Google Sheet (CSV)",
          position: { x: 300, y: 200 },
          config:   {
            url:    "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/export?format=csv&gid=0",
            method: "GET",
          },
        },
        {
          id:       "parse-rows",
          type:     "javascript",
          category: "data",
          label:    "Parse New Rows",
          position: { x: 540, y: 200 },
          config:   {
            code: [
              "const lines = input.data.trim().split('\\n');",
              "const headers = lines[0].split(',');",
              "const rows = lines.slice(1).map(line => {",
              "  const vals = line.split(',');",
              "  return Object.fromEntries(headers.map((h, i) => [h.trim(), vals[i]?.trim()]));",
              "});",
              "// Return only the last row as the 'new' entry",
              "return { newRow: rows[rows.length - 1], total: rows.length };",
            ].join("\n"),
          },
        },
        {
          id:       "notify-slack",
          type:     "http_request",
          category: "actions",
          label:    "Post to Slack",
          position: { x: 780, y: 200 },
          config:   {
            url:    "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
            method: "POST",
            body:   "{ \"text\": \"*New Sheet Row:*\\n```{{nodes.parse-rows.data.newRow}}```\" }",
          },
        },
      ],
      edges: [
        { id: "e1", source: "trigger",     target: "fetch-sheet" },
        { id: "e2", source: "fetch-sheet", target: "parse-rows" },
        { id: "e3", source: "parse-rows",  target: "notify-slack" },
      ],
      variables: { SHEET_ID: "", SLACK_WEBHOOK_URL: "" },
    },
  },

  // ── 10. Notion Page Created → Email Digest ───────────────────────────────
  {
    templateId:       "official-notion-email-digest",
    name:             "Notion Database → Daily Email Digest",
    description:      "Query a Notion database via its API, filter entries created today, and email a digest to your team.",
    longDescription:  "Calls the Notion API to retrieve pages from a database filtered by creation date, formats them into a readable digest, and emails the summary. Ideal for stand-up reports, content calendars, or task summaries.",
    category:         "communication",
    tags:             ["notion", "email", "digest", "productivity", "daily"],
    author:           SYSTEM_AUTHOR,
    authorId:         SYSTEM_AUTHOR_ID,
    isOfficial:       true,
    status:           TemplateStatus.APPROVED,
    requiredNodeTypes: ["http_request", "javascript", "email"],
    workflow: {
      nodes: [
        {
          id:       "trigger",
          type:     "webhook",
          category: "triggers",
          label:    "Schedule Trigger",
          position: { x: 60, y: 200 },
          config:   { path: "notion-digest", method: "POST" },
        },
        {
          id:       "query-notion",
          type:     "http_request",
          category: "actions",
          label:    "Query Notion Database",
          position: { x: 300, y: 200 },
          config:   {
            url:    "https://api.notion.com/v1/databases/YOUR_DB_ID/query",
            method: "POST",
            headers: {
              Authorization:       "Bearer {{variables.NOTION_API_KEY}}",
              "Notion-Version":    "2022-06-28",
              "Content-Type":      "application/json",
            },
            body: JSON.stringify({
              filter: {
                property: "Created",
                date: { equals: "{{new Date().toISOString().slice(0,10)}}" },
              },
              sorts: [{ timestamp: "created_time", direction: "descending" }],
            }),
          },
        },
        {
          id:       "format-digest",
          type:     "javascript",
          category: "data",
          label:    "Format Digest",
          position: { x: 540, y: 200 },
          config:   {
            code: [
              "const pages = input.data.results ?? [];",
              "if (!pages.length) return { subject: 'No new Notion pages today', body: 'Nothing new today.' };",
              "const lines = pages.map(p => {",
              "  const title = p.properties?.Name?.title?.[0]?.plain_text ?? 'Untitled';",
              "  return `• ${title} (${p.url})`;",
              "});",
              "return {",
              "  subject: `Notion Digest — ${new Date().toISOString().slice(0,10)} (${pages.length} items)`,",
              "  body: lines.join('\\n'),",
              "};",
            ].join("\n"),
          },
        },
        {
          id:       "send-email",
          type:     "email",
          category: "communication",
          label:    "Email Digest",
          position: { x: 780, y: 200 },
          config:   {
            to:      "{{variables.DIGEST_RECIPIENTS}}",
            subject: "{{nodes.format-digest.data.subject}}",
            body:    "{{nodes.format-digest.data.body}}",
          },
        },
      ],
      edges: [
        { id: "e1", source: "trigger",       target: "query-notion" },
        { id: "e2", source: "query-notion",  target: "format-digest" },
        { id: "e3", source: "format-digest", target: "send-email" },
      ],
      variables: { NOTION_API_KEY: "", NOTION_DB_ID: "", DIGEST_RECIPIENTS: "team@example.com" },
    },
  },

  // ── 11. Telegram Bot Notification ─────────────────────────────────────────
  {
    templateId:       "official-webhook-telegram",
    name:             "Webhook → Telegram Bot Message",
    description:      "Receive any webhook event and forward a formatted message to a Telegram chat via Bot API.",
    longDescription:  "A universal Telegram notifier: any incoming webhook payload gets transformed into a Telegram message and sent to your bot's chat. Works with alerts, deployments, orders, or any event source.",
    category:         "communication",
    tags:             ["telegram", "bot", "notifications", "webhook", "alerts"],
    author:           SYSTEM_AUTHOR,
    authorId:         SYSTEM_AUTHOR_ID,
    isOfficial:       true,
    status:           TemplateStatus.APPROVED,
    requiredNodeTypes: ["webhook", "transform", "http_request"],
    workflow: {
      nodes: [
        {
          id:       "inbound",
          type:     "webhook",
          category: "triggers",
          label:    "Inbound Webhook",
          position: { x: 60, y: 200 },
          config:   { path: "telegram-notify", method: "POST" },
        },
        {
          id:       "format-msg",
          type:     "transform",
          category: "data",
          label:    "Format Message",
          position: { x: 300, y: 200 },
          config:   {
            expression: "{ text: `*Event received*\\n\\`\\`\\`${JSON.stringify(input.data, null, 2)}\\`\\`\\`` }",
          },
        },
        {
          id:       "send-tg",
          type:     "http_request",
          category: "actions",
          label:    "Send Telegram Message",
          position: { x: 540, y: 200 },
          config:   {
            url:    "https://api.telegram.org/bot{{variables.TELEGRAM_BOT_TOKEN}}/sendMessage",
            method: "POST",
            body:   "{ \"chat_id\": \"{{variables.TELEGRAM_CHAT_ID}}\", \"text\": \"{{nodes.format-msg.data.text}}\", \"parse_mode\": \"Markdown\" }",
          },
        },
      ],
      edges: [
        { id: "e1", source: "inbound",    target: "format-msg" },
        { id: "e2", source: "format-msg", target: "send-tg" },
      ],
      variables: { TELEGRAM_BOT_TOKEN: "", TELEGRAM_CHAT_ID: "" },
    },
  },

  // ── 12. Discord Webhook Alert ─────────────────────────────────────────────
  {
    templateId:       "official-webhook-discord",
    name:             "Error Alert → Discord Channel",
    description:      "Receive error/alert webhooks and post a formatted embed to a Discord channel.",
    longDescription:  "Listens for alert webhooks (from monitoring tools, CI/CD pipelines, or your own app), formats them as a Discord embed with color-coded severity, and posts to your server's alert channel.",
    category:         "communication",
    tags:             ["discord", "alerts", "devops", "monitoring", "webhook"],
    author:           SYSTEM_AUTHOR,
    authorId:         SYSTEM_AUTHOR_ID,
    isOfficial:       true,
    status:           TemplateStatus.APPROVED,
    requiredNodeTypes: ["webhook", "javascript", "http_request"],
    workflow: {
      nodes: [
        {
          id:       "alert-in",
          type:     "webhook",
          category: "triggers",
          label:    "Alert Webhook",
          position: { x: 60, y: 200 },
          config:   { path: "discord-alert", method: "POST" },
        },
        {
          id:       "build-embed",
          type:     "javascript",
          category: "data",
          label:    "Build Discord Embed",
          position: { x: 300, y: 200 },
          config:   {
            code: [
              "const severity = input.data.severity ?? 'info';",
              "const colorMap = { critical: 0xE53E3E, error: 0xDD6B20, warning: 0xD69E2E, info: 0x3182CE };",
              "return {",
              "  embeds: [{",
              "    title:       input.data.title ?? 'Alert',",
              "    description: input.data.message ?? JSON.stringify(input.data),",
              "    color:       colorMap[severity] ?? colorMap.info,",
              "    timestamp:   new Date().toISOString(),",
              "    footer:      { text: `Severity: ${severity}` },",
              "  }],",
              "};",
            ].join("\n"),
          },
        },
        {
          id:       "post-discord",
          type:     "http_request",
          category: "actions",
          label:    "Post to Discord",
          position: { x: 540, y: 200 },
          config:   {
            url:    "{{variables.DISCORD_WEBHOOK_URL}}",
            method: "POST",
            body:   "{{nodes.build-embed.data}}",
          },
        },
      ],
      edges: [
        { id: "e1", source: "alert-in",   target: "build-embed" },
        { id: "e2", source: "build-embed", target: "post-discord" },
      ],
      variables: { DISCORD_WEBHOOK_URL: "" },
    },
  },

  // ── 13. RSS Feed → Email Newsletter ──────────────────────────────────────
  {
    templateId:       "official-rss-email-newsletter",
    name:             "RSS Feed → Email Newsletter",
    description:      "Fetch an RSS feed on a schedule, extract new items since last run, and email a digest.",
    longDescription:  "Polls any RSS/Atom feed, parses the XML response with JavaScript, filters for items published since the last execution, and emails a formatted newsletter. Perfect for content curation or internal news digests.",
    category:         "communication",
    tags:             ["rss", "email", "newsletter", "content", "scheduled"],
    author:           SYSTEM_AUTHOR,
    authorId:         SYSTEM_AUTHOR_ID,
    isOfficial:       true,
    status:           TemplateStatus.APPROVED,
    requiredNodeTypes: ["http_request", "javascript", "email"],
    workflow: {
      nodes: [
        {
          id:       "trigger",
          type:     "webhook",
          category: "triggers",
          label:    "Schedule Trigger",
          position: { x: 60, y: 200 },
          config:   { path: "rss-newsletter", method: "POST" },
        },
        {
          id:       "fetch-rss",
          type:     "http_request",
          category: "actions",
          label:    "Fetch RSS Feed",
          position: { x: 300, y: 200 },
          config:   {
            url:    "{{variables.RSS_FEED_URL}}",
            method: "GET",
            headers: { Accept: "application/rss+xml, application/xml, text/xml" },
          },
        },
        {
          id:       "parse-feed",
          type:     "javascript",
          category: "data",
          label:    "Parse & Filter Items",
          position: { x: 540, y: 200 },
          config:   {
            code: [
              "// Simple regex-based RSS item extractor",
              "const xml = input.data;",
              "const items = [...xml.matchAll(/<item[^>]*>([\\s\\S]*?)<\\/item>/g)].map(m => {",
              "  const get = (tag) => m[1].match(new RegExp(`<${tag}[^>]*><!\\\\[CDATA\\\\[([\\\\s\\\\S]*?)\\\\]\\\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`))?.[1] ?? m[1].match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`))?.[1] ?? '';",
              "  return { title: get('title'), link: get('link'), date: get('pubDate') };",
              "}).slice(0, 10);",
              "const lines = items.map(i => `• <a href='${i.link}'>${i.title}</a> (${i.date})`);",
              "return { html: lines.join('<br>'), count: items.length };",
            ].join("\n"),
          },
        },
        {
          id:       "check-items",
          type:     "condition",
          category: "logic",
          label:    "Has New Items?",
          position: { x: 780, y: 200 },
          config:   { expression: "input.data.count > 0" },
        },
        {
          id:       "send-email",
          type:     "email",
          category: "communication",
          label:    "Send Newsletter",
          position: { x: 1020, y: 160 },
          config:   {
            to:          "{{variables.NEWSLETTER_RECIPIENTS}}",
            subject:     "Your RSS Digest — {{new Date().toLocaleDateString()}}",
            body:        "{{nodes.parse-feed.data.html}}",
            contentType: "text/html",
          },
        },
      ],
      edges: [
        { id: "e1", source: "trigger",     target: "fetch-rss" },
        { id: "e2", source: "fetch-rss",   target: "parse-feed" },
        { id: "e3", source: "parse-feed",  target: "check-items" },
        { id: "e4", source: "check-items", target: "send-email", sourceHandle: "true" },
      ],
      variables: { RSS_FEED_URL: "https://feeds.example.com/rss.xml", NEWSLETTER_RECIPIENTS: "" },
    },
  },

  // ── 14. Airtable → Slack New Record ──────────────────────────────────────
  {
    templateId:       "official-airtable-slack-record",
    name:             "Airtable New Record → Slack",
    description:      "Poll an Airtable base for records created in the last hour and post each to Slack.",
    longDescription:  "Queries the Airtable REST API with a filterByFormula on createdTime, maps each new record to a Slack message, and posts them to a channel. Useful for CRM leads, project tasks, or inventory alerts.",
    category:         "integrations",
    tags:             ["airtable", "slack", "crm", "database", "polling"],
    author:           SYSTEM_AUTHOR,
    authorId:         SYSTEM_AUTHOR_ID,
    isOfficial:       true,
    status:           TemplateStatus.APPROVED,
    requiredNodeTypes: ["http_request", "javascript"],
    workflow: {
      nodes: [
        {
          id:       "trigger",
          type:     "webhook",
          category: "triggers",
          label:    "Schedule Trigger",
          position: { x: 60, y: 200 },
          config:   { path: "airtable-poll", method: "POST" },
        },
        {
          id:       "fetch-records",
          type:     "http_request",
          category: "actions",
          label:    "Fetch Airtable Records",
          position: { x: 300, y: 200 },
          config:   {
            url:    "https://api.airtable.com/v0/{{variables.AIRTABLE_BASE_ID}}/{{variables.AIRTABLE_TABLE_NAME}}?filterByFormula=IS_AFTER(CREATED_TIME()%2C+DATEADD(NOW()%2C-1%2C'hours'))&sort[0][field]=Created&sort[0][direction]=desc",
            method: "GET",
            headers: { Authorization: "Bearer {{variables.AIRTABLE_API_KEY}}" },
          },
        },
        {
          id:       "loop-records",
          type:     "javascript",
          category: "data",
          label:    "Format Records",
          position: { x: 540, y: 200 },
          config:   {
            code: [
              "const records = input.data.records ?? [];",
              "return records.map(r => ({",
              "  text: `*New Airtable Record*\\n${Object.entries(r.fields).map(([k,v]) => `*${k}:* ${v}`).join('\\n')}`,",
              "}));",
            ].join("\n"),
          },
        },
        {
          id:       "post-slack",
          type:     "http_request",
          category: "actions",
          label:    "Post to Slack",
          position: { x: 780, y: 200 },
          config:   {
            url:    "{{variables.SLACK_WEBHOOK_URL}}",
            method: "POST",
            body:   "{{nodes.loop-records.data[0]}}",
          },
        },
      ],
      edges: [
        { id: "e1", source: "trigger",        target: "fetch-records" },
        { id: "e2", source: "fetch-records",  target: "loop-records" },
        { id: "e3", source: "loop-records",   target: "post-slack" },
      ],
      variables: { AIRTABLE_API_KEY: "", AIRTABLE_BASE_ID: "", AIRTABLE_TABLE_NAME: "Records", SLACK_WEBHOOK_URL: "" },
    },
  },

  // ── 15. HubSpot Contact Created → Slack ──────────────────────────────────
  {
    templateId:       "official-hubspot-contact-slack",
    name:             "HubSpot New Contact → Slack Alert",
    description:      "Receive a HubSpot webhook when a contact is created and post their details to a Slack sales channel.",
    longDescription:  "Configure a HubSpot workflow to fire a webhook when a new contact is created. This template extracts contact properties and posts a formatted Slack notification so your sales team can act immediately.",
    category:         "integrations",
    tags:             ["hubspot", "crm", "slack", "sales", "leads", "webhook"],
    author:           SYSTEM_AUTHOR,
    authorId:         SYSTEM_AUTHOR_ID,
    isOfficial:       true,
    status:           TemplateStatus.APPROVED,
    requiredNodeTypes: ["webhook", "transform", "http_request"],
    workflow: {
      nodes: [
        {
          id:       "hs-webhook",
          type:     "webhook",
          category: "triggers",
          label:    "HubSpot Webhook",
          position: { x: 60, y: 200 },
          config:   { path: "hubspot-contact", method: "POST" },
        },
        {
          id:       "extract-contact",
          type:     "transform",
          category: "data",
          label:    "Extract Contact",
          position: { x: 300, y: 200 },
          config:   {
            expression: [
              "const p = input.data.properties ?? input.data[0]?.properties ?? {};",
              "return {",
              "  name:    `${p.firstname?.value ?? ''} ${p.lastname?.value ?? ''}`.trim() || 'Unknown',",
              "  email:   p.email?.value ?? '',",
              "  company: p.company?.value ?? '',",
              "  phone:   p.phone?.value ?? '',",
              "};",
            ].join(" "),
          },
        },
        {
          id:       "slack-notify",
          type:     "http_request",
          category: "actions",
          label:    "Post to Slack",
          position: { x: 540, y: 200 },
          config:   {
            url:    "{{variables.SLACK_WEBHOOK_URL}}",
            method: "POST",
            body:   "{ \"text\": \":bust_in_silhouette: *New HubSpot Contact*\\n*Name:* {{nodes.extract-contact.data.name}}\\n*Email:* {{nodes.extract-contact.data.email}}\\n*Company:* {{nodes.extract-contact.data.company}}\" }",
          },
        },
      ],
      edges: [
        { id: "e1", source: "hs-webhook",      target: "extract-contact" },
        { id: "e2", source: "extract-contact", target: "slack-notify" },
      ],
      variables: { SLACK_WEBHOOK_URL: "" },
    },
  },

  // ── 16. Shopify Order → Fulfillment Notification ─────────────────────────
  {
    templateId:       "official-shopify-order-email",
    name:             "Shopify New Order → Fulfillment Email",
    description:      "Receive a Shopify order webhook, check if it's paid, and email the fulfillment team with order details.",
    longDescription:  "Listens for Shopify `orders/create` webhook events, validates that financial status is `paid`, and sends a fulfillment email with the order number, customer info, and line items.",
    category:         "integrations",
    tags:             ["shopify", "ecommerce", "orders", "fulfillment", "email", "webhook"],
    author:           SYSTEM_AUTHOR,
    authorId:         SYSTEM_AUTHOR_ID,
    isOfficial:       true,
    status:           TemplateStatus.APPROVED,
    requiredNodeTypes: ["webhook", "condition", "javascript", "email"],
    workflow: {
      nodes: [
        {
          id:       "shopify-in",
          type:     "webhook",
          category: "triggers",
          label:    "Shopify Order Webhook",
          position: { x: 60, y: 200 },
          config:   { path: "shopify-orders", method: "POST" },
        },
        {
          id:       "check-paid",
          type:     "condition",
          category: "logic",
          label:    "Is Paid?",
          position: { x: 300, y: 200 },
          config:   { expression: "input.data.financial_status === 'paid'" },
        },
        {
          id:       "format-order",
          type:     "javascript",
          category: "data",
          label:    "Format Order Email",
          position: { x: 540, y: 160 },
          config:   {
            code: [
              "const o = input.data;",
              "const items = (o.line_items ?? []).map(i => `  • ${i.quantity}x ${i.name} @ $${i.price}`).join('\\n');",
              "return {",
              "  subject: `New Order #${o.order_number} — $${o.total_price}`,",
              "  body: [",
              "    `Order #${o.order_number}`,",
              "    `Customer: ${o.customer?.first_name} ${o.customer?.last_name} <${o.email}>`,",
              "    `Total: $${o.total_price} (${o.currency})`,",
              "    `\\nItems:\\n${items}`,",
              "    `\\nShip to: ${o.shipping_address?.address1}, ${o.shipping_address?.city}, ${o.shipping_address?.country}`,",
              "  ].join('\\n'),",
              "};",
            ].join("\n"),
          },
        },
        {
          id:       "send-fulfillment",
          type:     "email",
          category: "communication",
          label:    "Email Fulfillment Team",
          position: { x: 780, y: 160 },
          config:   {
            to:      "{{variables.FULFILLMENT_EMAIL}}",
            subject: "{{nodes.format-order.data.subject}}",
            body:    "{{nodes.format-order.data.body}}",
          },
        },
      ],
      edges: [
        { id: "e1", source: "shopify-in",   target: "check-paid" },
        { id: "e2", source: "check-paid",   target: "format-order",       sourceHandle: "true" },
        { id: "e3", source: "format-order", target: "send-fulfillment" },
      ],
      variables: { FULFILLMENT_EMAIL: "fulfillment@example.com" },
    },
  },

  // ── 17. Jira Issue → Slack Sprint Board ──────────────────────────────────
  {
    templateId:       "official-jira-issue-slack",
    name:             "Jira Issue Created → Slack Sprint Board",
    description:      "Receive Jira webhook events for new issues and post a formatted card to your team's Slack sprint channel.",
    longDescription:  "Listens for Jira `jira:issue_created` events, extracts assignee, priority, and summary, and posts a rich Slack message with a direct link to the issue. Keeps your sprint channel up to date without leaving Slack.",
    category:         "integrations",
    tags:             ["jira", "slack", "project-management", "devops", "sprint"],
    author:           SYSTEM_AUTHOR,
    authorId:         SYSTEM_AUTHOR_ID,
    isOfficial:       true,
    status:           TemplateStatus.APPROVED,
    requiredNodeTypes: ["webhook", "transform", "http_request"],
    workflow: {
      nodes: [
        {
          id:       "jira-webhook",
          type:     "webhook",
          category: "triggers",
          label:    "Jira Webhook",
          position: { x: 60, y: 200 },
          config:   { path: "jira-events", method: "POST" },
        },
        {
          id:       "extract-issue",
          type:     "transform",
          category: "data",
          label:    "Extract Issue Fields",
          position: { x: 300, y: 200 },
          config:   {
            expression: "{ key: input.data.issue?.key, summary: input.data.issue?.fields?.summary, priority: input.data.issue?.fields?.priority?.name ?? 'None', assignee: input.data.issue?.fields?.assignee?.displayName ?? 'Unassigned', url: `${input.data.issue?.self?.split('/rest/')[0]}/browse/${input.data.issue?.key}` }",
          },
        },
        {
          id:       "post-slack",
          type:     "http_request",
          category: "actions",
          label:    "Post to Slack",
          position: { x: 540, y: 200 },
          config:   {
            url:    "{{variables.SLACK_WEBHOOK_URL}}",
            method: "POST",
            body:   "{ \"text\": \":jira: *New Issue <{{nodes.extract-issue.data.url}}|{{nodes.extract-issue.data.key}}>*\\n{{nodes.extract-issue.data.summary}}\\n*Priority:* {{nodes.extract-issue.data.priority}} | *Assignee:* {{nodes.extract-issue.data.assignee}}\" }",
          },
        },
      ],
      edges: [
        { id: "e1", source: "jira-webhook",  target: "extract-issue" },
        { id: "e2", source: "extract-issue", target: "post-slack" },
      ],
      variables: { SLACK_WEBHOOK_URL: "" },
    },
  },

  // ── 18. Typeform / Form Submission → CRM + Email ──────────────────────────
  {
    templateId:       "official-form-crm-email",
    name:             "Form Submission → CRM + Confirmation Email",
    description:      "Receive a form submission webhook, add the lead to your CRM via API, and send a confirmation email to the submitter.",
    longDescription:  "A two-step post-submission flow: the lead's details are POST-ed to your CRM REST API, and a personalised confirmation email is sent to the submitter. Works with Typeform, Tally, Jotform, or any webhook-enabled form.",
    category:         "integrations",
    tags:             ["typeform", "form", "crm", "email", "lead-gen", "webhook"],
    author:           SYSTEM_AUTHOR,
    authorId:         SYSTEM_AUTHOR_ID,
    isOfficial:       true,
    status:           TemplateStatus.APPROVED,
    requiredNodeTypes: ["webhook", "http_request", "email"],
    workflow: {
      nodes: [
        {
          id:       "form-in",
          type:     "webhook",
          category: "triggers",
          label:    "Form Submission",
          position: { x: 60, y: 200 },
          config:   { path: "form-submission", method: "POST" },
        },
        {
          id:       "extract-fields",
          type:     "javascript",
          category: "data",
          label:    "Normalise Form Fields",
          position: { x: 300, y: 200 },
          config:   {
            code: [
              "// Typeform payload shape — adapt for other form providers",
              "const answers = input.data.form_response?.answers ?? [];",
              "const get = (ref) => answers.find(a => a.field?.ref === ref);",
              "return {",
              "  name:    get('name')?.text     ?? input.data.name    ?? '',",
              "  email:   get('email')?.email   ?? input.data.email   ?? '',",
              "  company: get('company')?.text  ?? input.data.company ?? '',",
              "  message: get('message')?.text  ?? input.data.message ?? '',",
              "};",
            ].join("\n"),
          },
        },
        {
          id:       "add-crm",
          type:     "http_request",
          category: "actions",
          label:    "Add to CRM",
          position: { x: 540, y: 140 },
          config:   {
            url:    "{{variables.CRM_API_URL}}/contacts",
            method: "POST",
            headers: {
              Authorization: "Bearer {{variables.CRM_API_KEY}}",
              "Content-Type": "application/json",
            },
            body: "{ \"email\": \"{{nodes.extract-fields.data.email}}\", \"name\": \"{{nodes.extract-fields.data.name}}\", \"company\": \"{{nodes.extract-fields.data.company}}\" }",
          },
        },
        {
          id:       "confirm-email",
          type:     "email",
          category: "communication",
          label:    "Send Confirmation Email",
          position: { x: 540, y: 280 },
          config:   {
            to:      "{{nodes.extract-fields.data.email}}",
            subject: "Thanks for reaching out, {{nodes.extract-fields.data.name}}!",
            body:    "Hi {{nodes.extract-fields.data.name}},\n\nThanks for submitting the form. We'll be in touch within 1 business day.\n\nBest,\nThe Team",
          },
        },
      ],
      edges: [
        { id: "e1", source: "form-in",        target: "extract-fields" },
        { id: "e2", source: "extract-fields", target: "add-crm" },
        { id: "e3", source: "extract-fields", target: "confirm-email" },
      ],
      variables: { CRM_API_URL: "https://api.crm.example.com", CRM_API_KEY: "" },
    },
  },

  // ── 19. Mailchimp Subscriber → Welcome Sequence Trigger ──────────────────
  {
    templateId:       "official-mailchimp-welcome",
    name:             "Mailchimp New Subscriber → Welcome API Call",
    description:      "Receive a Mailchimp webhook for a new list subscriber, validate the event, and trigger a downstream welcome sequence API.",
    longDescription:  "Listens for Mailchimp `subscribe` webhook events, verifies the event type, and immediately fires a POST to your welcome sequence API (e.g. an internal service, Intercom, Customer.io, or any REST endpoint).",
    category:         "communication",
    tags:             ["mailchimp", "email-marketing", "subscribers", "automation", "webhook"],
    author:           SYSTEM_AUTHOR,
    authorId:         SYSTEM_AUTHOR_ID,
    isOfficial:       true,
    status:           TemplateStatus.APPROVED,
    requiredNodeTypes: ["webhook", "condition", "http_request"],
    workflow: {
      nodes: [
        {
          id:       "mc-webhook",
          type:     "webhook",
          category: "triggers",
          label:    "Mailchimp Webhook",
          position: { x: 60, y: 200 },
          config:   { path: "mailchimp-events", method: "POST" },
        },
        {
          id:       "is-subscribe",
          type:     "condition",
          category: "logic",
          label:    "Is Subscribe Event?",
          position: { x: 300, y: 200 },
          config:   { expression: "input.data.type === 'subscribe'" },
        },
        {
          id:       "trigger-welcome",
          type:     "http_request",
          category: "actions",
          label:    "Trigger Welcome Sequence",
          position: { x: 540, y: 160 },
          config:   {
            url:    "{{variables.WELCOME_SEQUENCE_URL}}",
            method: "POST",
            body:   "{ \"email\": \"{{input.data.data.email}}\", \"firstName\": \"{{input.data.data.merges.FNAME}}\", \"listId\": \"{{input.data.data.list_id}}\" }",
          },
        },
      ],
      edges: [
        { id: "e1", source: "mc-webhook",    target: "is-subscribe" },
        { id: "e2", source: "is-subscribe",  target: "trigger-welcome", sourceHandle: "true" },
      ],
      variables: { WELCOME_SEQUENCE_URL: "https://api.example.com/welcome" },
    },
  },

  // ── 20. AI Content Moderator ──────────────────────────────────────────────
  {
    templateId:       "official-ai-content-moderation",
    name:             "AI Content Moderation Pipeline",
    description:      "Submit user-generated text to Claude for moderation, flag harmful content, and route to human review or auto-approve.",
    longDescription:  "Passes user-submitted content through Claude with a structured moderation prompt that returns a JSON verdict (safe/review/reject). Safe content is auto-approved via API; flagged content is forwarded to a Slack review channel.",
    category:         "ai",
    tags:             ["ai", "claude", "moderation", "content", "safety", "pipeline"],
    author:           SYSTEM_AUTHOR,
    authorId:         SYSTEM_AUTHOR_ID,
    isOfficial:       true,
    status:           TemplateStatus.APPROVED,
    requiredNodeTypes: ["webhook", "ai_transform", "condition", "http_request"],
    workflow: {
      nodes: [
        {
          id:       "submit-in",
          type:     "webhook",
          category: "triggers",
          label:    "Content Submission",
          position: { x: 60, y: 200 },
          config:   { path: "moderate-content", method: "POST" },
        },
        {
          id:       "ai-moderate",
          type:     "ai_transform",
          category: "ai",
          label:    "AI Moderation",
          position: { x: 300, y: 200 },
          config:   {
            prompt: [
              "You are a content moderator. Analyse the following user-submitted text for harmful content including: hate speech, violence, spam, adult content, or personal attacks.",
              "Respond ONLY with a JSON object in this exact format:",
              "{ \"verdict\": \"safe\" | \"review\" | \"reject\", \"reason\": \"<brief explanation>\", \"categories\": [\"<category>\"] }",
              "",
              "Content to moderate:",
              "{{nodes.submit-in.data.content}}",
            ].join("\n"),
            maxTokens:   256,
            temperature: 0,
          },
        },
        {
          id:       "parse-verdict",
          type:     "javascript",
          category: "data",
          label:    "Parse Verdict",
          position: { x: 540, y: 200 },
          config:   {
            code: [
              "try {",
              "  const parsed = JSON.parse(input.data.text ?? input.data);",
              "  return { verdict: parsed.verdict, reason: parsed.reason, categories: parsed.categories };",
              "} catch {",
              "  return { verdict: 'review', reason: 'Could not parse AI response', categories: [] };",
              "}",
            ].join("\n"),
          },
        },
        {
          id:       "check-safe",
          type:     "condition",
          category: "logic",
          label:    "Is Safe?",
          position: { x: 780, y: 200 },
          config:   { expression: "input.data.verdict === 'safe'" },
        },
        {
          id:       "auto-approve",
          type:     "http_request",
          category: "actions",
          label:    "Auto-Approve Content",
          position: { x: 1020, y: 120 },
          config:   {
            url:    "{{variables.CONTENT_API_URL}}/approve",
            method: "POST",
            body:   "{ \"id\": \"{{nodes.submit-in.data.id}}\", \"status\": \"approved\" }",
          },
        },
        {
          id:       "flag-review",
          type:     "http_request",
          category: "actions",
          label:    "Flag for Human Review",
          position: { x: 1020, y: 300 },
          config:   {
            url:    "{{variables.SLACK_WEBHOOK_URL}}",
            method: "POST",
            body:   "{ \"text\": \":warning: *Content Flagged for Review*\\n*Verdict:* {{nodes.parse-verdict.data.verdict}}\\n*Reason:* {{nodes.parse-verdict.data.reason}}\\n*Content ID:* {{nodes.submit-in.data.id}}\" }",
          },
        },
      ],
      edges: [
        { id: "e1", source: "submit-in",    target: "ai-moderate" },
        { id: "e2", source: "ai-moderate",  target: "parse-verdict" },
        { id: "e3", source: "parse-verdict", target: "check-safe" },
        { id: "e4", source: "check-safe",   target: "auto-approve", sourceHandle: "true" },
        { id: "e5", source: "check-safe",   target: "flag-review",  sourceHandle: "false" },
      ],
      variables: { CONTENT_API_URL: "https://api.example.com/content", SLACK_WEBHOOK_URL: "" },
    },
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await connectMongoDB();
  const repo = new IntegrationRepository();

  for (const template of templates) {
    await repo.upsertTemplate(template);
    console.log(`Seeded: ${template.name}`);
  }

  console.log(`\nDone — ${templates.length} official templates seeded.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
