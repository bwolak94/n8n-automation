import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import cronstrue from "cronstrue";
import { CronExpressionParser } from "cron-parser";
import CronBuilder from "../CronBuilder.vue";

// ─── Mock @vue-flow/core (required by any transitive imports) ─────────────────

vi.mock("@vue-flow/core", () => ({
  Handle:        { template: "<div />" },
  Position:      { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  useVueFlow:    vi.fn(() => ({})),
  useNode:       vi.fn(() => ({ node: {} })),
  NodeToolbar:   { template: "<div><slot /></div>" },
}));

// ─── Unit: buildSimpleCron logic ─────────────────────────────────────────────

describe("CronBuilder — buildSimpleCron", () => {
  function mount_() {
    return mount(CronBuilder, {
      props: { modelValue: "0 9 * * *" },
    });
  }

  it("every 30 minutes → */30 * * * *", () => {
    const wrapper = mount_();
    const result  = (wrapper.vm as unknown as { buildSimpleCron: (c: object) => string }).buildSimpleCron({
      type: "minutes", value: 30, time: "09:00", weekday: 1, day: 1,
    });
    expect(result).toBe("*/30 * * * *");
  });

  it("every Monday at 09:00 → 0 9 * * 1", () => {
    const wrapper = mount_();
    const result  = (wrapper.vm as unknown as { buildSimpleCron: (c: object) => string }).buildSimpleCron({
      type: "weekly", value: 1, time: "09:00", weekday: 1, day: 1,
    });
    expect(result).toBe("0 9 * * 1");
  });

  it("monthly on day 15 at 00:00 → 0 0 15 * *", () => {
    const wrapper = mount_();
    const result  = (wrapper.vm as unknown as { buildSimpleCron: (c: object) => string }).buildSimpleCron({
      type: "monthly", value: 1, time: "00:00", weekday: 1, day: 15,
    });
    expect(result).toBe("0 0 15 * *");
  });

  it("daily at 14:30 → 30 14 * * *", () => {
    const wrapper = mount_();
    const result  = (wrapper.vm as unknown as { buildSimpleCron: (c: object) => string }).buildSimpleCron({
      type: "daily", value: 1, time: "14:30", weekday: 1, day: 1,
    });
    expect(result).toBe("30 14 * * *");
  });
});

// ─── Unit: cronstrue integration ──────────────────────────────────────────────

describe("cronstrue.toString", () => {
  it('converts "0 9 * * 1" to human-readable Monday description', () => {
    const text = cronstrue.toString("0 9 * * 1", { use24HourTimeFormat: true });
    expect(text).toContain("09:00");
    expect(text.toLowerCase()).toContain("monday");
  });

  it('converts "*/15 * * * *" to every 15 minutes', () => {
    const text = cronstrue.toString("*/15 * * * *", { use24HourTimeFormat: true });
    expect(text).toContain("15");
    expect(text.toLowerCase()).toContain("minute");
  });

  it('converts "0 0 1 * *" to monthly description', () => {
    const text = cronstrue.toString("0 0 1 * *", { use24HourTimeFormat: true });
    expect(text.toLowerCase()).toContain("month");
  });
});

// ─── Unit: cron-parser next runs ─────────────────────────────────────────────

describe("cron-parser next runs", () => {
  it("computes 5 future dates from a valid cron expression", () => {
    const interval = CronExpressionParser.parse("0 9 * * 1", { tz: "UTC" });
    const runs: Date[] = [];
    for (let i = 0; i < 5; i++) {
      runs.push(interval.next().toDate());
    }
    expect(runs).toHaveLength(5);
    for (const run of runs) {
      expect(run.getUTCHours()).toBe(9);
      expect(run.getUTCMinutes()).toBe(0);
    }
  });

  it("all 5 computed dates are in the future", () => {
    const now      = Date.now();
    const interval = CronExpressionParser.parse("0 * * * *", { tz: "UTC" });
    for (let i = 0; i < 5; i++) {
      expect(interval.next().toDate().getTime()).toBeGreaterThan(now);
    }
  });
});

// ─── Component tests ─────────────────────────────────────────────────────────

describe("CronBuilder component", () => {
  function mountBuilder(modelValue = "0 9 * * *") {
    return mount(CronBuilder, {
      props:  { modelValue },
      global: {
        stubs: {},
      },
    });
  }

  it("renders cron output display", () => {
    const wrapper = mountBuilder();
    expect(wrapper.find("[data-testid='cron-output']").exists()).toBe(true);
  });

  it("shows simple mode by default", () => {
    const wrapper = mountBuilder();
    expect(wrapper.find("[data-testid='simple-mode']").exists()).toBe(true);
  });

  it("switches to raw mode when Raw tab clicked", async () => {
    const wrapper = mountBuilder();
    await wrapper.find("[data-testid='mode-tab-raw']").trigger("click");
    expect(wrapper.find("[data-testid='raw-mode']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='raw-input']").exists()).toBe(true);
  });

  it("switches to advanced mode when Advanced tab clicked", async () => {
    const wrapper = mountBuilder();
    await wrapper.find("[data-testid='mode-tab-advanced']").trigger("click");
    expect(wrapper.find("[data-testid='advanced-mode']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='advanced-minute']").exists()).toBe(true);
  });

  it("preset 'Every hour' sets cron to '0 * * * *'", async () => {
    const wrapper = mountBuilder();
    await wrapper.find("[data-testid='preset-every-hour']").trigger("click");
    const output = wrapper.find("[data-testid='cron-output']").text();
    expect(output.trim()).toBe("0 * * * *");
  });

  it("preset 'Daily 00:00' sets cron to '0 0 * * *'", async () => {
    const wrapper = mountBuilder();
    await wrapper.find("[data-testid='preset-daily-00:00']").trigger("click");
    expect(wrapper.find("[data-testid='cron-output']").text().trim()).toBe("0 0 * * *");
  });

  it("shows human-readable text for valid expression", async () => {
    const wrapper = mountBuilder("0 9 * * 1");
    await wrapper.find("[data-testid='mode-tab-raw']").trigger("click");
    await wrapper.find("[data-testid='raw-input']").setValue("0 9 * * 1");
    await wrapper.vm.$nextTick();
    const readable = wrapper.find("[data-testid='human-readable']");
    expect(readable.exists()).toBe(true);
    expect(readable.text().length).toBeGreaterThan(0);
  });

  it("shows validation error for invalid cron in raw mode", async () => {
    const wrapper = mountBuilder();
    await wrapper.find("[data-testid='mode-tab-raw']").trigger("click");
    await wrapper.find("[data-testid='raw-input']").setValue("not a cron");
    await wrapper.vm.$nextTick();
    expect(wrapper.find("[data-testid='validation-error']").exists()).toBe(true);
  });

  it("does not emit update:modelValue when cron is invalid", async () => {
    const wrapper = mountBuilder();
    await wrapper.find("[data-testid='mode-tab-raw']").trigger("click");
    await wrapper.find("[data-testid='raw-input']").setValue("bad!");
    await wrapper.vm.$nextTick();
    // Only the initial valid emit should have been fired
    const emitted = wrapper.emitted("update:modelValue") as string[][];
    const invalidEmits = emitted?.filter((args) => args[0] === "bad!") ?? [];
    expect(invalidEmits).toHaveLength(0);
  });

  it("shows next 5 runs list for valid cron", async () => {
    const wrapper = mountBuilder("0 9 * * *");
    await wrapper.vm.$nextTick();
    // Next runs list should contain items
    expect(wrapper.find("[data-testid='next-run-0']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='next-run-4']").exists()).toBe(true);
  });
});
