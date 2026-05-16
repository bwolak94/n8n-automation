import { describe, it, expect, beforeEach } from "vitest";
import { useUndoRedo } from "../useUndoRedo.js";

describe("useUndoRedo", () => {
  it("starts with empty history and no undo/redo available", () => {
    const { canUndo, canRedo } = useUndoRedo<number>();
    expect(canUndo.value).toBe(false);
    expect(canRedo.value).toBe(false);
  });

  it("push enables undo", () => {
    const { push, canUndo } = useUndoRedo<number>();
    push(1);
    expect(canUndo.value).toBe(true);
  });

  it("undo restores the previous state", () => {
    const { push, undo, canUndo } = useUndoRedo<number>();
    push(1);
    push(2);
    const restored = undo(3); // current is 3, undo → get 2
    expect(restored).toBe(2);
    expect(canUndo.value).toBe(true); // 1 still in past
  });

  it("undo returns undefined when nothing to undo", () => {
    const { undo } = useUndoRedo<number>();
    expect(undo(99)).toBeUndefined();
  });

  it("redo re-applies the undone state", () => {
    const { push, undo, redo } = useUndoRedo<number>();
    push(1);
    undo(2); // 1 back, 2 in future
    const redone = redo(1); // current is 1, redo → get 2
    expect(redone).toBe(2);
  });

  it("redo returns undefined when nothing to redo", () => {
    const { redo } = useUndoRedo<number>();
    expect(redo(5)).toBeUndefined();
  });

  it("push clears the redo stack", () => {
    const { push, undo, canRedo } = useUndoRedo<number>();
    push(1);
    undo(2);
    expect(canRedo.value).toBe(true);
    push(99); // new action clears redo
    expect(canRedo.value).toBe(false);
  });

  it("history is capped at maxHistory (50 by default)", () => {
    const { push, past } = useUndoRedo<number>(50);
    for (let i = 0; i < 60; i++) push(i);
    expect(past.value.length).toBe(50);
    // Oldest entry was evicted
    expect(past.value[0]).toBe(10);
  });

  it("history is capped at a custom maxHistory", () => {
    const { push, past } = useUndoRedo<number>(3);
    push(1);
    push(2);
    push(3);
    push(4);
    expect(past.value.length).toBe(3);
    expect(past.value[0]).toBe(2);
  });

  it("clear empties both past and future", () => {
    const { push, undo, clear, canUndo, canRedo } = useUndoRedo<number>();
    push(1);
    push(2);
    undo(3);
    clear();
    expect(canUndo.value).toBe(false);
    expect(canRedo.value).toBe(false);
  });

  it("multiple undos work correctly", () => {
    const { push, undo } = useUndoRedo<string>();
    push("a");
    push("b");
    push("c");
    expect(undo("d")).toBe("c");
    expect(undo("c")).toBe("b");
    expect(undo("b")).toBe("a");
  });
});
