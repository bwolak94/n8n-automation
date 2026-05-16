import { describe, it, expect } from "vitest";
import { parseCronDescription } from "../cronDescription.js";

describe("parseCronDescription", () => {
  // ─── Valid expressions ─────────────────────────────────────────────────────

  it("describes every minute", () => {
    const result = parseCronDescription("* * * * *");
    expect(result).toMatchObject({ valid: true, description: "Every minute" });
  });

  it("describes every hour at :30", () => {
    const result = parseCronDescription("30 * * * *");
    expect(result).toMatchObject({ valid: true, description: "Every hour at :30" });
  });

  it("describes every day at 09:00", () => {
    const result = parseCronDescription("0 9 * * *");
    expect(result).toMatchObject({ valid: true, description: "Every day at 09:00" });
  });

  it("describes every Monday at 09:00 (0 9 * * 1)", () => {
    const result = parseCronDescription("0 9 * * 1");
    expect(result).toMatchObject({ valid: true, description: "Every Monday at 09:00" });
  });

  it("describes every Sunday (day 0)", () => {
    const result = parseCronDescription("0 0 * * 0");
    expect(result).toMatchObject({ valid: true, description: "Every Sunday at 00:00" });
  });

  it("describes every Friday at 17:00", () => {
    const result = parseCronDescription("0 17 * * 5");
    expect(result).toMatchObject({ valid: true, description: "Every Friday at 17:00" });
  });

  it("describes every month on the 1st", () => {
    const result = parseCronDescription("0 0 1 * *");
    expect(result).toMatchObject({ valid: true, description: expect.stringContaining("1st") });
  });

  it("describes every 15 minutes (*/15)", () => {
    const result = parseCronDescription("*/15 * * * *");
    expect(result).toMatchObject({ valid: true, description: "Every 15 minutes" });
  });

  it("handles leading/trailing spaces", () => {
    const result = parseCronDescription("  0 9 * * 1  ");
    expect(result).toMatchObject({ valid: true });
  });

  // ─── Invalid expressions ───────────────────────────────────────────────────

  it("returns error for wrong number of fields (too few)", () => {
    const result = parseCronDescription("* * *");
    expect(result).toMatchObject({ valid: false });
    expect("error" in result && result.error).toContain("5 fields");
  });

  it("returns error for wrong number of fields (too many)", () => {
    const result = parseCronDescription("0 9 * * * *");
    expect(result).toMatchObject({ valid: false });
  });

  it("returns error for invalid minute value", () => {
    const result = parseCronDescription("60 9 * * *");
    expect(result).toMatchObject({ valid: false });
    expect("error" in result && result.error).toContain("Minute");
  });

  it("returns error for invalid hour value", () => {
    const result = parseCronDescription("0 25 * * *");
    expect(result).toMatchObject({ valid: false });
    expect("error" in result && result.error).toContain("Hour");
  });

  it("returns error for invalid weekday value", () => {
    const result = parseCronDescription("0 9 * * 7");
    expect(result).toMatchObject({ valid: false });
    expect("error" in result && result.error).toContain("Weekday");
  });

  it("returns error for non-numeric characters", () => {
    const result = parseCronDescription("abc def * * *");
    expect(result).toMatchObject({ valid: false });
  });
});
