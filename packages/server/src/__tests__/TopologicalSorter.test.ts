import { describe, it, expect } from "@jest/globals";
import { TopologicalSorter } from "../engine/TopologicalSorter.js";
import { CyclicWorkflowError } from "../shared/errors/index.js";

const sorter = new TopologicalSorter();

describe("TopologicalSorter", () => {
  describe("linear chain", () => {
    it("returns nodes in dependency order", () => {
      const groups = sorter.sort(["a", "b", "c"], [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
      ]);
      expect(groups).toEqual([["a"], ["b"], ["c"]]);
    });
  });

  describe("parallel branches", () => {
    it("groups independent nodes together", () => {
      // a → b, a → c (b and c are independent)
      const groups = sorter.sort(["a", "b", "c"], [
        { from: "a", to: "b" },
        { from: "a", to: "c" },
      ]);
      expect(groups[0]).toEqual(["a"]);
      expect(groups[1]).toHaveLength(2);
      expect(groups[1]).toEqual(expect.arrayContaining(["b", "c"]));
    });
  });

  describe("diamond (fan-out / fan-in)", () => {
    it("returns correct 3-group order", () => {
      // a → b, a → c, b → d, c → d
      const groups = sorter.sort(["a", "b", "c", "d"], [
        { from: "a", to: "b" },
        { from: "a", to: "c" },
        { from: "b", to: "d" },
        { from: "c", to: "d" },
      ]);
      expect(groups[0]).toEqual(["a"]);
      expect(groups[1]).toEqual(expect.arrayContaining(["b", "c"]));
      expect(groups[2]).toEqual(["d"]);
    });
  });

  describe("single node", () => {
    it("returns a single group with the one node", () => {
      expect(sorter.sort(["a"], [])).toEqual([["a"]]);
    });
  });

  describe("disconnected graph", () => {
    it("groups disconnected nodes in the first batch", () => {
      // a and b have no edges — both have in-degree 0
      const groups = sorter.sort(["a", "b"], []);
      expect(groups).toHaveLength(1);
      expect(groups[0]).toEqual(expect.arrayContaining(["a", "b"]));
    });
  });

  describe("cycle detection", () => {
    it("throws CyclicWorkflowError for a simple cycle", () => {
      expect(() =>
        sorter.sort(["a", "b"], [
          { from: "a", to: "b" },
          { from: "b", to: "a" },
        ])
      ).toThrow(CyclicWorkflowError);
    });

    it("throws CyclicWorkflowError for a 3-node cycle", () => {
      expect(() =>
        sorter.sort(["a", "b", "c"], [
          { from: "a", to: "b" },
          { from: "b", to: "c" },
          { from: "c", to: "a" },
        ])
      ).toThrow(CyclicWorkflowError);
    });
  });

  describe("self-loop", () => {
    it("throws CyclicWorkflowError for a self-referencing node", () => {
      expect(() =>
        sorter.sort(["a"], [{ from: "a", to: "a" }])
      ).toThrow(CyclicWorkflowError);
    });
  });
});
