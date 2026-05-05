import { describe, it, expect } from "@jest/globals";
import { SandboxExecutor } from "../../nodes/implementations/function/SandboxExecutor.js";

const executor = new SandboxExecutor();

// ─── Basic execution ─────────────────────────────────────────────────────────

describe("SandboxExecutor", () => {
  describe("return value", () => {
    it("returns a plain object from `return { ... }`", async () => {
      const { output } = await executor.execute("return { x: 1, y: 2 };", null);
      expect(output).toEqual({ x: 1, y: 2 });
    });

    it("returns an array", async () => {
      const { output } = await executor.execute("return [1, 2, 3];", null);
      expect(output).toEqual([1, 2, 3]);
    });

    it("returns null when no return statement", async () => {
      const { output } = await executor.execute("const x = 1;", null);
      expect(output).toBeNull();
    });

    it("returns a nested structure", async () => {
      const { output } = await executor.execute(
        "return { user: { name: 'Alice', scores: [10, 20] } };",
        null
      );
      expect(output).toEqual({ user: { name: "Alice", scores: [10, 20] } });
    });
  });

  // ── $input access ──────────────────────────────────────────────────────────

  describe("$input access", () => {
    it("exposes input data as $input", async () => {
      const { output } = await executor.execute(
        "return { echo: $input.name };",
        { name: "test" }
      );
      expect(output).toEqual({ echo: "test" });
    });

    it("allows reading nested $input properties", async () => {
      const { output } = await executor.execute(
        "return { val: $input.a.b.c };",
        { a: { b: { c: 42 } } }
      );
      expect(output).toEqual({ val: 42 });
    });

    it("handles null $input gracefully", async () => {
      const { output } = await executor.execute(
        "return { hasInput: $input !== null };",
        null
      );
      expect(output).toEqual({ hasInput: false });
    });

    it("input can be an array", async () => {
      const { output } = await executor.execute(
        "return { len: $input.length };",
        [1, 2, 3]
      );
      expect(output).toEqual({ len: 3 });
    });
  });

  // ── console capture ────────────────────────────────────────────────────────

  describe("console capture", () => {
    it("captures console.log output in logs array", async () => {
      const { logs } = await executor.execute(
        "console.log('hello', 'world'); return {};",
        null
      );
      expect(logs).toContain("hello world");
    });

    it("captures multiple console.log calls in order", async () => {
      const { logs } = await executor.execute(
        "console.log('first'); console.log('second'); return {};",
        null
      );
      expect(logs[0]).toBe("first");
      expect(logs[1]).toBe("second");
    });

    it("captures console.warn with prefix", async () => {
      const { logs } = await executor.execute(
        "console.warn('careful'); return {};",
        null
      );
      expect(logs[0]).toMatch(/\[warn\].*careful/);
    });

    it("serialises objects in console.log", async () => {
      const { logs } = await executor.execute(
        "console.log({ x: 1 }); return {};",
        null
      );
      expect(logs[0]).toContain('"x":1');
    });

    it("returns empty logs array when nothing is logged", async () => {
      const { logs } = await executor.execute("return { x: 1 };", null);
      expect(logs).toEqual([]);
    });
  });

  // ── timeout ────────────────────────────────────────────────────────────────

  describe("timeout enforcement", () => {
    it("throws FUNCTION_TIMEOUT on infinite loop", async () => {
      await expect(
        executor.execute("while(true){}", null, 100)
      ).rejects.toMatchObject({ code: "FUNCTION_TIMEOUT" });
    });

    it("throws FUNCTION_TIMEOUT with a correct error code", async () => {
      const err = await executor.execute("while(true){}", null, 100).catch((e) => e);
      expect(err.statusCode).toBe(408);
    });
  });

  // ── forbidden APIs ─────────────────────────────────────────────────────────

  describe("forbidden APIs", () => {
    it("throws FUNCTION_RUNTIME_ERROR when require() is used", async () => {
      await expect(
        executor.execute("require('fs');", null)
      ).rejects.toMatchObject({ code: "FUNCTION_RUNTIME_ERROR" });
    });

    it("throws when process is accessed", async () => {
      await expect(
        executor.execute("return process.env;", null)
      ).rejects.toMatchObject({ code: "FUNCTION_RUNTIME_ERROR" });
    });

    it("throws when fetch is accessed", async () => {
      await expect(
        executor.execute("return fetch('http://example.com');", null)
      ).rejects.toMatchObject({ code: "FUNCTION_RUNTIME_ERROR" });
    });
  });

  // ── lodash utilities ───────────────────────────────────────────────────────

  describe("_ (lodash subset)", () => {
    it("_.groupBy groups array by field", async () => {
      const input = {
        items: [
          { type: "a", val: 1 },
          { type: "b", val: 2 },
          { type: "a", val: 3 },
        ],
      };
      const { output } = await executor.execute(
        "return _.groupBy($input.items, 'type');",
        input
      );
      const data = output as Record<string, unknown[]>;
      expect(data["a"]).toHaveLength(2);
      expect(data["b"]).toHaveLength(1);
    });

    it("_.pick returns only specified keys", async () => {
      const { output } = await executor.execute(
        "return _.pick($input, ['id', 'name']);",
        { id: 1, name: "Alice", password: "secret" }
      );
      expect(output).toEqual({ id: 1, name: "Alice" });
    });

    it("_.omit removes specified keys", async () => {
      const { output } = await executor.execute(
        "return _.omit($input, ['password']);",
        { id: 1, name: "Alice", password: "secret" }
      );
      expect(output).toEqual({ id: 1, name: "Alice" });
    });

    it("_.sortBy sorts array by field", async () => {
      const { output } = await executor.execute(
        "return _.sortBy($input, 'n');",
        [{ n: 3 }, { n: 1 }, { n: 2 }]
      );
      expect(output).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
    });

    it("_.flatten flattens one level", async () => {
      const { output } = await executor.execute(
        "return _.flatten($input);",
        [[1, 2], [3, 4], [5]]
      );
      expect(output).toEqual([1, 2, 3, 4, 5]);
    });

    it("_.uniq removes duplicates", async () => {
      const { output } = await executor.execute(
        "return _.uniq($input);",
        [1, 2, 2, 3, 1]
      );
      expect(output).toEqual([1, 2, 3]);
    });

    it("_.chunk splits array into chunks", async () => {
      const { output } = await executor.execute(
        "return _.chunk($input, 2);",
        [1, 2, 3, 4, 5]
      );
      expect(output).toEqual([[1, 2], [3, 4], [5]]);
    });
  });

  // ── date-fns utilities ────────────────────────────────────────────────────

  describe("date-fns subset", () => {
    it("parseISO parses an ISO string to a Date-like object", async () => {
      const { output } = await executor.execute(
        "const d = parseISO('2024-06-15T00:00:00.000Z'); return { year: d.getFullYear() };",
        null
      );
      expect((output as { year: number }).year).toBe(2024);
    });

    it("format produces a human-readable date string", async () => {
      const { output } = await executor.execute(
        "return { str: format(parseISO('2024-06-15'), 'MMM dd, yyyy') };",
        null
      );
      expect((output as { str: string }).str).toBe("Jun 15, 2024");
    });

    it("addDays adds the correct number of days", async () => {
      const { output } = await executor.execute(
        "const d = addDays(parseISO('2024-01-01'), 10); return { day: d.getDate() };",
        null
      );
      expect((output as { day: number }).day).toBe(11);
    });

    it("differenceInDays computes day difference", async () => {
      const { output } = await executor.execute(
        "return { diff: differenceInDays(parseISO('2024-01-11'), parseISO('2024-01-01')) };",
        null
      );
      expect((output as { diff: number }).diff).toBe(10);
    });
  });

  // ── integration with FunctionNode example ─────────────────────────────────

  describe("real-world example", () => {
    it("extracts domain from email and formats date", async () => {
      const input = {
        user: { email: "alice@example.com", createdAt: "2024-03-15T00:00:00.000Z" },
      };
      const code = `
        const email = $input.user.email;
        const domain = email.split('@')[1];
        const joined = format(parseISO($input.user.createdAt), 'MMM dd, yyyy');
        return { domain, joined, email };
      `;
      const { output } = await executor.execute(code, input);
      const data = output as Record<string, string>;
      expect(data["domain"]).toBe("example.com");
      expect(data["joined"]).toBe("Mar 15, 2024");
      expect(data["email"]).toBe("alice@example.com");
    });
  });
});
