import { describe, expect, it, jest, beforeEach } from "@jest/globals";

// ── Mock @anthropic-ai/sdk before any import that loads it ───────────────────
const mockCreate = jest.fn<() => Promise<unknown>>();

jest.unstable_mockModule("@anthropic-ai/sdk", () => ({
  default: jest.fn(() => ({
    messages: { create: mockCreate },
  })),
}));

const { ClaudeProvider } = await import(
  "../../../nodes/ai/ClaudeProvider.js"
);

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeSuccessResponse(overrides: Record<string, unknown> = {}) {
  return {
    model: "claude-sonnet-4-6",
    content: [{ type: "text", text: "Hello from Claude" }],
    usage: { input_tokens: 10, output_tokens: 20 },
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ClaudeProvider", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("has name 'claude'", () => {
    const provider = new ClaudeProvider("key");
    expect(provider.name).toBe("claude");
  });

  it("calls Anthropic messages.create and maps response correctly", async () => {
    mockCreate.mockResolvedValue(makeSuccessResponse());
    const provider = new ClaudeProvider("test-key");

    const response = await provider.complete({
      model: "claude-sonnet-4-6",
      prompt: "Hello!",
    });

    expect(response.result).toBe("Hello from Claude");
    expect(response.tokensUsed).toBe(30); // 10 + 20
    expect(response.model).toBe("claude-sonnet-4-6");
  });

  it("passes system prompt when provided", async () => {
    mockCreate.mockResolvedValue(makeSuccessResponse());
    const provider = new ClaudeProvider("test-key");

    await provider.complete({
      model: "claude-sonnet-4-6",
      prompt: "Hello",
      systemPrompt: "Be concise.",
    });

    const callArgs = (mockCreate.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(callArgs["system"]).toBe("Be concise.");
  });

  it("passes maxTokens and temperature", async () => {
    mockCreate.mockResolvedValue(makeSuccessResponse());
    const provider = new ClaudeProvider("test-key");

    await provider.complete({
      model: "claude-sonnet-4-6",
      prompt: "Hi",
      maxTokens: 256,
      temperature: 0.5,
    });

    const callArgs = (mockCreate.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(callArgs["max_tokens"]).toBe(256);
    expect(callArgs["temperature"]).toBe(0.5);
  });

  it("handles non-text content blocks gracefully", async () => {
    mockCreate.mockResolvedValue({
      model: "claude-sonnet-4-6",
      content: [{ type: "tool_use", id: "1", name: "fn", input: {} }],
      usage: { input_tokens: 5, output_tokens: 5 },
    });
    const provider = new ClaudeProvider("test-key");

    const response = await provider.complete({
      model: "claude-sonnet-4-6",
      prompt: "Hi",
    });

    expect(response.result).toBe("");
  });

  it("throws AppError with code AI_RATE_LIMITED on 429", async () => {
    const err = Object.assign(new Error("Rate limit exceeded"), { status: 429 });
    mockCreate.mockRejectedValue(err);
    const provider = new ClaudeProvider("test-key");

    await expect(
      provider.complete({ model: "claude-sonnet-4-6", prompt: "Hi" })
    ).rejects.toMatchObject({ code: "AI_RATE_LIMITED", statusCode: 429 });
  });

  it("throws AppError with code AI_AUTH_FAILED on 401", async () => {
    const err = Object.assign(new Error("Unauthorized"), { status: 401 });
    mockCreate.mockRejectedValue(err);
    const provider = new ClaudeProvider("bad-key");

    await expect(
      provider.complete({ model: "claude-sonnet-4-6", prompt: "Hi" })
    ).rejects.toMatchObject({ code: "AI_AUTH_FAILED", statusCode: 401 });
  });

  it("wraps generic errors as AI_PROVIDER_ERROR", async () => {
    mockCreate.mockRejectedValue(new Error("Network error"));
    const provider = new ClaudeProvider("test-key");

    await expect(
      provider.complete({ model: "claude-sonnet-4-6", prompt: "Hi" })
    ).rejects.toMatchObject({ code: "AI_PROVIDER_ERROR" });
  });
});
