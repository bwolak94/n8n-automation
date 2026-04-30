import { describe, it, expect, beforeEach } from "@jest/globals";
import { PackageValidator } from "../../modules/marketplace/PackageValidator.js";
import { ValidationError } from "../../shared/errors/index.js";

describe("PackageValidator", () => {
  let validator: PackageValidator;

  beforeEach(() => {
    validator = new PackageValidator();
  });

  // ── validateManifest ───────────────────────────────────────────────────────

  describe("validateManifest", () => {
    it("accepts a valid package.json", () => {
      const manifest = validator.validateManifest({
        name: "@acme/my-node",
        version: "1.0.0",
        main: "index.js",
      });
      expect(manifest.name).toBe("@acme/my-node");
      expect(manifest.version).toBe("1.0.0");
      expect(manifest.main).toBe("index.js");
    });

    it("throws ValidationError when name is missing", () => {
      expect(() => validator.validateManifest({ version: "1.0.0", main: "index.js" })).toThrow(ValidationError);
    });

    it("throws ValidationError when version is missing", () => {
      expect(() => validator.validateManifest({ name: "pkg", main: "index.js" })).toThrow(ValidationError);
    });

    it("throws ValidationError when main is missing", () => {
      expect(() => validator.validateManifest({ name: "pkg", version: "1.0.0" })).toThrow(ValidationError);
    });

    it("throws ValidationError for non-object input", () => {
      expect(() => validator.validateManifest("not-an-object")).toThrow(ValidationError);
      expect(() => validator.validateManifest(null)).toThrow(ValidationError);
    });
  });

  // ── validateConfigPresence ─────────────────────────────────────────────────

  describe("validateConfigPresence", () => {
    it("passes when automation-hub.config.ts is present", () => {
      expect(() =>
        validator.validateConfigPresence(["index.js", "automation-hub.config.ts"])
      ).not.toThrow();
    });

    it("passes when automation-hub.config.js is present", () => {
      expect(() =>
        validator.validateConfigPresence(["index.js", "automation-hub.config.js"])
      ).not.toThrow();
    });

    it("throws ValidationError when config file is absent", () => {
      expect(() =>
        validator.validateConfigPresence(["index.js", "README.md"])
      ).toThrow(ValidationError);
    });

    it("throws when file list is empty", () => {
      expect(() => validator.validateConfigPresence([])).toThrow(ValidationError);
    });
  });

  // ── validateConfig ─────────────────────────────────────────────────────────

  describe("validateConfig", () => {
    it("accepts a valid config with allowed permissions", () => {
      const cfg = validator.validateConfig({
        nodeType: "my-custom-node",
        permissions: ["http"],
      });
      expect(cfg.nodeType).toBe("my-custom-node");
      expect(cfg.permissions).toEqual(["http"]);
    });

    it("accepts empty permissions array", () => {
      const cfg = validator.validateConfig({ nodeType: "no-perm-node", permissions: [] });
      expect(cfg.permissions).toHaveLength(0);
    });

    it("accepts all allowed permissions", () => {
      expect(() =>
        validator.validateConfig({ nodeType: "full-node", permissions: ["http", "credentials"] })
      ).not.toThrow();
    });

    it("throws ValidationError for undeclared permission", () => {
      expect(() =>
        validator.validateConfig({ nodeType: "bad-node", permissions: ["fs"] })
      ).toThrow(ValidationError);
    });

    it("throws ValidationError for 'child_process' permission", () => {
      expect(() =>
        validator.validateConfig({ nodeType: "bad-node", permissions: ["child_process"] })
      ).toThrow(ValidationError);
    });

    it("throws ValidationError when nodeType is missing", () => {
      expect(() =>
        validator.validateConfig({ permissions: ["http"] })
      ).toThrow(ValidationError);
    });

    it("throws ValidationError when permissions is not an array", () => {
      expect(() =>
        validator.validateConfig({ nodeType: "node", permissions: "http" })
      ).toThrow(ValidationError);
    });

    it("throws for non-object input", () => {
      expect(() => validator.validateConfig(null)).toThrow(ValidationError);
    });
  });

  // ── validateSource ─────────────────────────────────────────────────────────

  describe("validateSource", () => {
    it("accepts clean source code", () => {
      const clean = `
        const https = require('https');
        module.exports = { definition: { type: 'my-node', name: 'My Node' }, execute: async () => ({ data: null }) };
      `;
      expect(() => validator.validateSource(clean)).not.toThrow();
    });

    it("blocks require('fs')", () => {
      expect(() =>
        validator.validateSource("const fs = require('fs');")
      ).toThrow(ValidationError);
    });

    it("blocks require(\"fs\") with double quotes", () => {
      expect(() =>
        validator.validateSource('const fs = require("fs");')
      ).toThrow(ValidationError);
    });

    it("blocks require('child_process')", () => {
      expect(() =>
        validator.validateSource("const cp = require('child_process');")
      ).toThrow(ValidationError);
    });

    it("blocks eval()", () => {
      expect(() =>
        validator.validateSource("eval('malicious code');")
      ).toThrow(ValidationError);
    });

    it("blocks new Function()", () => {
      expect(() =>
        validator.validateSource("const fn = new Function('return 42');")
      ).toThrow(ValidationError);
    });

    it("blocks dynamic require with variable", () => {
      expect(() =>
        validator.validateSource("const mod = require(moduleName);")
      ).toThrow(ValidationError);
    });

    it("includes filename in error message", () => {
      expect(() =>
        validator.validateSource("eval('x')", "src/index.ts")
      ).toThrow("src/index.ts");
    });
  });

  // ── validateINode ──────────────────────────────────────────────────────────

  describe("validateINode", () => {
    it("passes a valid INode implementation", () => {
      const node = {
        definition: { type: "custom-node", name: "Custom Node" },
        execute: async () => ({ data: null }),
      };
      expect(() => validator.validateINode(node)).not.toThrow();
    });

    it("throws when candidate is not an object", () => {
      expect(() => validator.validateINode(null)).toThrow(ValidationError);
      expect(() => validator.validateINode("string")).toThrow(ValidationError);
      expect(() => validator.validateINode(42)).toThrow(ValidationError);
    });

    it("throws when definition is missing", () => {
      expect(() => validator.validateINode({ execute: async () => ({}) })).toThrow(ValidationError);
    });

    it("throws when definition.type is missing", () => {
      expect(() =>
        validator.validateINode({ definition: { name: "No Type" }, execute: async () => ({}) })
      ).toThrow(ValidationError);
    });

    it("throws when execute is not a function", () => {
      expect(() =>
        validator.validateINode({ definition: { type: "t", name: "n" }, execute: "not-a-fn" })
      ).toThrow(ValidationError);
    });
  });
});
