import { describe, it, expect } from "@jest/globals";
import { execute } from "../../nodes/implementations/transform/TransformExecutor.js";
import type { TransformOperation } from "@automation-hub/shared";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const op = (o: TransformOperation) => o;

// ─── pick ─────────────────────────────────────────────────────────────────────

describe("TransformExecutor — pick", () => {
  it("keeps only specified fields on an object", () => {
    const result = execute({ id: 1, email: "a@b.com", secret: "x" }, [
      op({ op: "pick", fields: ["id", "email"] }),
    ]);
    expect(result).toEqual({ id: 1, email: "a@b.com" });
  });

  it("keeps only specified fields on each item in an array", () => {
    const result = execute(
      [{ id: 1, name: "Alice", role: "admin" }, { id: 2, name: "Bob", role: "user" }],
      [op({ op: "pick", fields: ["id", "name"] })]
    );
    expect(result).toEqual([{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }]);
  });

  it("returns undefined for fields not present", () => {
    const result = execute({ a: 1 }, [op({ op: "pick", fields: ["a", "b"] })]);
    expect(result).toEqual({ a: 1, b: undefined });
  });
});

// ─── omit ─────────────────────────────────────────────────────────────────────

describe("TransformExecutor — omit", () => {
  it("removes specified fields from an object", () => {
    const result = execute({ id: 1, password: "x", email: "a@b.com" }, [
      op({ op: "omit", fields: ["password"] }),
    ]);
    expect(result).toEqual({ id: 1, email: "a@b.com" });
  });

  it("removes specified fields from each item in an array", () => {
    const result = execute(
      [{ id: 1, secret: "x" }, { id: 2, secret: "y" }],
      [op({ op: "omit", fields: ["secret"] })]
    );
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });
});

// ─── rename ───────────────────────────────────────────────────────────────────

describe("TransformExecutor — rename", () => {
  it("renames specified keys on an object", () => {
    const result = execute({ createdAt: "2024-01-01", name: "Alice" }, [
      op({ op: "rename", mapping: { createdAt: "signupDate" } }),
    ]);
    expect(result).toEqual({ signupDate: "2024-01-01", name: "Alice" });
  });

  it("renames keys on each item in an array", () => {
    const result = execute(
      [{ old: 1 }, { old: 2 }],
      [op({ op: "rename", mapping: { old: "new" } })]
    );
    expect(result).toEqual([{ new: 1 }, { new: 2 }]);
  });

  it("leaves unmapped keys unchanged", () => {
    const result = execute({ a: 1, b: 2 }, [op({ op: "rename", mapping: { a: "A" } })]);
    expect(result).toEqual({ A: 1, b: 2 });
  });
});

// ─── compute ──────────────────────────────────────────────────────────────────

describe("TransformExecutor — compute", () => {
  it("adds a new field resolved from input dot-path", () => {
    const result = execute({ user: { email: "alice@acme.com" } }, [
      op({ op: "compute", field: "email", expression: "input.user.email" }),
    ]);
    expect((result as Record<string, unknown>)["email"]).toBe("alice@acme.com");
  });

  it("resolves expression with {{ }} delimiters", () => {
    const result = execute({ score: 42 }, [
      op({ op: "compute", field: "doubled", expression: "{{ input.score }}" }),
    ]);
    expect((result as Record<string, unknown>)["doubled"]).toBe(42);
  });

  it("outputs null for an invalid expression path", () => {
    const result = execute({ x: 1 }, [
      op({ op: "compute", field: "bad", expression: "unknown.path" }),
    ]);
    expect((result as Record<string, unknown>)["bad"]).toBeNull();
  });

  it("adds new field to each array item", () => {
    const result = execute(
      [{ name: "Alice", age: 30 }, { name: "Bob", age: 25 }],
      [op({ op: "compute", field: "greeting", expression: "input.name" })]
    ) as Record<string, unknown>[];
    expect(result[0]?.["greeting"]).toBe("Alice");
    expect(result[1]?.["greeting"]).toBe("Bob");
  });

  it("outputs null when expression fails (not a crash)", () => {
    const result = execute({ a: 1 }, [
      op({ op: "compute", field: "x", expression: "nope.nothing.here" }),
    ]);
    expect((result as Record<string, unknown>)["x"]).toBeNull();
  });
});

// ─── filter ───────────────────────────────────────────────────────────────────

describe("TransformExecutor — filter", () => {
  it("removes items where condition is false", () => {
    const result = execute(
      [{ age: 10 }, { age: 25 }, { age: 17 }],
      [op({ op: "filter", condition: { field: "age", operator: "greater_than", value: 18, dataType: "number" } })]
    );
    expect(result).toEqual([{ age: 25 }]);
  });

  it("keeps all items when all pass the condition", () => {
    const result = execute(
      [{ status: "active" }, { status: "active" }],
      [op({ op: "filter", condition: { field: "status", operator: "equals", value: "active" } })]
    );
    expect(result).toEqual([{ status: "active" }, { status: "active" }]);
  });

  it("is a no-op (skipped) when input is not an array", () => {
    const data = { status: "active" };
    const result = execute(data, [
      op({ op: "filter", condition: { field: "status", operator: "equals", value: "active" } }),
    ]);
    expect(result).toEqual(data);
  });

  it("filters by is_empty condition", () => {
    const result = execute(
      [{ name: "" }, { name: "Alice" }],
      [op({ op: "filter", condition: { field: "name", operator: "is_not_empty" } })]
    );
    expect(result).toEqual([{ name: "Alice" }]);
  });
});

// ─── sort ─────────────────────────────────────────────────────────────────────

describe("TransformExecutor — sort", () => {
  it("sorts ascending by a numeric field", () => {
    const result = execute(
      [{ score: 3 }, { score: 1 }, { score: 2 }],
      [op({ op: "sort", field: "score", direction: "asc" })]
    );
    expect(result).toEqual([{ score: 1 }, { score: 2 }, { score: 3 }]);
  });

  it("sorts descending by a numeric field", () => {
    const result = execute(
      [{ score: 3 }, { score: 1 }, { score: 2 }],
      [op({ op: "sort", field: "score", direction: "desc" })]
    );
    expect(result).toEqual([{ score: 3 }, { score: 2 }, { score: 1 }]);
  });

  it("sorts ascending by a string field", () => {
    const result = execute(
      [{ name: "Charlie" }, { name: "Alice" }, { name: "Bob" }],
      [op({ op: "sort", field: "name", direction: "asc" })]
    );
    expect(result).toEqual([{ name: "Alice" }, { name: "Bob" }, { name: "Charlie" }]);
  });

  it("does not mutate the original array", () => {
    const arr = [{ n: 3 }, { n: 1 }];
    execute(arr, [op({ op: "sort", field: "n", direction: "asc" })]);
    expect(arr[0]?.["n"]).toBe(3); // unchanged
  });
});

// ─── groupBy ─────────────────────────────────────────────────────────────────

describe("TransformExecutor — groupBy", () => {
  it("groups array items by field value into an object", () => {
    const result = execute(
      [{ role: "admin", name: "Alice" }, { role: "user", name: "Bob" }, { role: "admin", name: "Charlie" }],
      [op({ op: "groupBy", field: "role" })]
    );
    expect(result).toEqual({
      admin: [{ role: "admin", name: "Alice" }, { role: "admin", name: "Charlie" }],
      user:  [{ role: "user",  name: "Bob" }],
    });
  });

  it("returns empty object for empty array", () => {
    expect(execute([], [op({ op: "groupBy", field: "x" })])).toEqual({});
  });

  it("is a no-op on non-array input", () => {
    const data = { a: 1 };
    expect(execute(data, [op({ op: "groupBy", field: "a" })])).toEqual(data);
  });
});

// ─── flatten ─────────────────────────────────────────────────────────────────

describe("TransformExecutor — flatten", () => {
  it("flattens one level by default when depth is undefined", () => {
    const result = execute([[1, 2], [3, [4]]], [op({ op: "flatten" })]);
    expect(result).toEqual([1, 2, 3, 4]); // Infinity depth
  });

  it("flattens to the specified depth", () => {
    const result = execute([[1, [2, [3]]], [4]], [op({ op: "flatten", depth: 1 })]);
    expect(result).toEqual([1, [2, [3]], 4]);
  });

  it("is a no-op on non-array input", () => {
    const data = { a: 1 };
    expect(execute(data, [op({ op: "flatten" })])).toEqual(data);
  });
});

// ─── merge ────────────────────────────────────────────────────────────────────

describe("TransformExecutor — merge", () => {
  it("merges static data into an object", () => {
    const result = execute({ a: 1 }, [op({ op: "merge", data: { b: 2, c: 3 } })]);
    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });

  it("static data keys win on collision", () => {
    const result = execute({ a: 1, b: "old" }, [op({ op: "merge", data: { b: "new" } })]);
    expect((result as Record<string, unknown>)["b"]).toBe("new");
  });

  it("deep-merges nested objects", () => {
    const result = execute(
      { user: { name: "Alice", age: 30 } },
      [op({ op: "merge", data: { user: { role: "admin" } } })]
    );
    expect(result).toEqual({ user: { name: "Alice", age: 30, role: "admin" } });
  });
});

// ─── Sequential operations ─────────────────────────────────────────────────────

describe("TransformExecutor — sequential operations", () => {
  it("applies pick then compute in order", () => {
    const data = { id: 1, email: "a@b.com", password: "secret" };
    const result = execute(data, [
      op({ op: "pick",    fields: ["id", "email"] }),
      op({ op: "compute", field: "hasEmail", expression: "input.email" }),
    ]) as Record<string, unknown>;
    expect(result["password"]).toBeUndefined(); // pick removed it
    expect(result["hasEmail"]).toBe("a@b.com");
  });

  it("passes through unchanged when operations array is empty", () => {
    const data = { x: 1, y: 2 };
    expect(execute(data, [])).toEqual(data);
  });

  it("applies rename then filter in order", () => {
    const data = [{ val: 5 }, { val: 15 }, { val: 20 }];
    const result = execute(data, [
      op({ op: "rename", mapping: { val: "score" } }),
      op({ op: "filter", condition: { field: "score", operator: "greater_than", value: 10, dataType: "number" } }),
    ]);
    expect(result).toEqual([{ score: 15 }, { score: 20 }]);
  });

  it("applies omit then sort", () => {
    const data = [{ n: 3, x: "a" }, { n: 1, x: "b" }, { n: 2, x: "c" }];
    const result = execute(data, [
      op({ op: "omit",   fields: ["x"] }),
      op({ op: "sort",   field: "n", direction: "asc" }),
    ]);
    expect(result).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
  });
});
