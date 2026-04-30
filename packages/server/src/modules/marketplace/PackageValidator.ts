import { ValidationError } from "../../shared/errors/index.js";

// ─── Config types ─────────────────────────────────────────────────────────────

export const ALLOWED_PERMISSIONS = new Set(["http", "credentials"]);

export interface AutomationHubConfig {
  nodeType: string;
  permissions: string[];
  category?: string;
}

export interface PackageManifest {
  name: string;
  version: string;
  main: string;
  automationHub?: { configFile?: string };
}

// ─── Forbidden AST patterns (regex-based source scan) ─────────────────────────

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /require\s*\(\s*['"]fs['"]\s*\)/,
    message: "Import of 'fs' module is not allowed",
  },
  {
    pattern: /require\s*\(\s*['"]child_process['"]\s*\)/,
    message: "Import of 'child_process' module is not allowed",
  },
  {
    pattern: /\beval\s*\(/,
    message: "Use of eval() is not allowed",
  },
  {
    pattern: /new\s+Function\s*\(/,
    message: "Dynamic Function construction is not allowed",
  },
  {
    // Dynamic require: require(variable) — require( followed by non-quote
    pattern: /require\s*\(\s*(?!['"`])[^)]+\s*\)/,
    message: "Dynamic require() with non-literal argument is not allowed",
  },
];

// ─── PackageValidator ─────────────────────────────────────────────────────────

export class PackageValidator {
  // ── Manifest validation ────────────────────────────────────────────────────

  validateManifest(raw: unknown): PackageManifest {
    if (typeof raw !== "object" || raw === null) {
      throw new ValidationError("package.json must be a valid JSON object");
    }
    const pkg = raw as Record<string, unknown>;

    if (typeof pkg["name"] !== "string" || !pkg["name"].trim()) {
      throw new ValidationError("package.json must have a non-empty 'name' field");
    }
    if (typeof pkg["version"] !== "string" || !pkg["version"].trim()) {
      throw new ValidationError("package.json must have a non-empty 'version' field");
    }
    if (typeof pkg["main"] !== "string" || !pkg["main"].trim()) {
      throw new ValidationError("package.json must have a non-empty 'main' field");
    }

    return {
      name:           pkg["name"] as string,
      version:        pkg["version"] as string,
      main:           pkg["main"] as string,
      automationHub:  pkg["automationHub"] as PackageManifest["automationHub"],
    };
  }

  // ── automation-hub.config.ts presence ─────────────────────────────────────

  validateConfigPresence(files: readonly string[]): void {
    const hasConfig = files.some((f) => f.endsWith("automation-hub.config.ts") || f.endsWith("automation-hub.config.js"));
    if (!hasConfig) {
      throw new ValidationError(
        "Package must include an 'automation-hub.config.ts' file at the package root"
      );
    }
  }

  // ── Automation Hub config object ───────────────────────────────────────────

  validateConfig(raw: unknown): AutomationHubConfig {
    if (typeof raw !== "object" || raw === null) {
      throw new ValidationError("automation-hub.config must export a valid config object");
    }
    const cfg = raw as Record<string, unknown>;

    if (typeof cfg["nodeType"] !== "string" || !cfg["nodeType"].trim()) {
      throw new ValidationError("automation-hub.config must have a non-empty 'nodeType' field");
    }

    const permissions = cfg["permissions"];
    if (!Array.isArray(permissions)) {
      throw new ValidationError("automation-hub.config 'permissions' must be an array");
    }

    for (const perm of permissions as unknown[]) {
      if (!ALLOWED_PERMISSIONS.has(perm as string)) {
        throw new ValidationError(
          `Permission '${perm}' is not in the allowed set: [${[...ALLOWED_PERMISSIONS].join(", ")}]`
        );
      }
    }

    return {
      nodeType:    cfg["nodeType"] as string,
      permissions: permissions as string[],
      category:    typeof cfg["category"] === "string" ? cfg["category"] : undefined,
    };
  }

  // ── Source code scan ───────────────────────────────────────────────────────

  validateSource(sourceCode: string, filename = "unknown"): void {
    for (const { pattern, message } of FORBIDDEN_PATTERNS) {
      if (pattern.test(sourceCode)) {
        throw new ValidationError(`Security violation in '${filename}': ${message}`);
      }
    }
  }

  // ── INode interface check ──────────────────────────────────────────────────

  validateINode(candidate: unknown): void {
    if (typeof candidate !== "object" || candidate === null) {
      throw new ValidationError("Node module must export an object implementing INode");
    }
    const node = candidate as Record<string, unknown>;
    if (
      typeof node["definition"] !== "object" ||
      node["definition"] === null ||
      typeof (node["definition"] as Record<string, unknown>)["type"] !== "string" ||
      typeof (node["definition"] as Record<string, unknown>)["name"] !== "string"
    ) {
      throw new ValidationError(
        "INode.definition must have string 'type' and 'name' properties"
      );
    }
    if (typeof node["execute"] !== "function") {
      throw new ValidationError("INode must implement an 'execute' method");
    }
  }
}
