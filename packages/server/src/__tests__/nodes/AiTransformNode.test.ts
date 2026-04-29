import { describe, expect, it, jest } from "@jest/globals";
import { AiTransformNode } from "../../nodes/implementations/AiTransformNode.js";
import { MockAiProvider } from "../../nodes/ai/MockAiProvider.js";
import type { IAiProvider, AiRequest, AiResponse } from "../../nodes/contracts/IAiProvider.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ctx: ExecutionContext = {
  tenantId: "t-1",
  executionId: "exec-1",
  workflowId: "wf-1",
  variables: {},
};

function makeProvider(
  overrides: Partial<AiResponse> = {}
): IAiProvider & { complete: jest.Mock } {
  return {
    name: "test",
    complete: jest.fn<(r: AiRequest) => Promise<AiResponse>>().mockResolvedValue({
      result: "AI response",
      tokensUsed: 42,
      model: "test-model",
      ...overrides,
    }),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("AiTransformNode", () => {
  it("has correct definition type", () => {
    const node = new AiTransformNode(new MockAiProvider());
    expect(node.definition.type).toBe("ai_transform");
  });

  it("returns result, tokensUsed, and model from provider", async () => {
    const provider = makeProvider({
      result: "Extracted: John",
      tokensUsed: 55,
      model: "claude-sonnet-4-6",
    });
    const node = new AiTransformNode(provider);

    const output = await node.execute(
      { name: "John" },
      { prompt: "Extract the name: {{input}}" },
      ctx
    );

    const data = output.data as Record<string, unknown>;
    expect(data["result"]).toBe("Extracted: John");
    expect(data["tokensUsed"]).toBe(55);
    expect(data["model"]).toBe("claude-sonnet-4-6");
  });

  it("interpolates {{input}} with JSON-serialised input", async () => {
    const provider = makeProvider();
    const node = new AiTransformNode(provider);
    const input = { id: 1, name: "Alice" };

    await node.execute(input, { prompt: "Process: {{input}}" }, ctx);

    const [callArg] = (provider.complete as jest.Mock).mock.calls[0] as [AiRequest];
    expect(callArg.prompt).toBe(`Process: ${JSON.stringify(input)}`);
  });

  it("passes systemPrompt to provider", async () => {
    const provider = makeProvider();
    const node = new AiTransformNode(provider);

    await node.execute(
      {},
      { prompt: "Do something", systemPrompt: "You are a helpful assistant." },
      ctx
    );

    const [callArg] = (provider.complete as jest.Mock).mock.calls[0] as [AiRequest];
    expect(callArg.systemPrompt).toBe("You are a helpful assistant.");
  });

  it("passes maxTokens and temperature to provider", async () => {
    const provider = makeProvider();
    const node = new AiTransformNode(provider);

    await node.execute(
      {},
      { prompt: "Do something", maxTokens: 512, temperature: 0.2 },
      ctx
    );

    const [callArg] = (provider.complete as jest.Mock).mock.calls[0] as [AiRequest];
    expect(callArg.maxTokens).toBe(512);
    expect(callArg.temperature).toBe(0.2);
  });

  it("defaults model to claude-sonnet-4-6 when not specified", async () => {
    const provider = makeProvider();
    const node = new AiTransformNode(provider);

    await node.execute({}, { prompt: "Hello" }, ctx);

    const [callArg] = (provider.complete as jest.Mock).mock.calls[0] as [AiRequest];
    expect(callArg.model).toBe("claude-sonnet-4-6");
  });

  it("uses the specified model override", async () => {
    const provider = makeProvider();
    const node = new AiTransformNode(provider);

    await node.execute({}, { prompt: "Hello", model: "gpt-4o" }, ctx);

    const [callArg] = (provider.complete as jest.Mock).mock.calls[0] as [AiRequest];
    expect(callArg.model).toBe("gpt-4o");
  });

  it("throws AppError when prompt is missing", async () => {
    const node = new AiTransformNode(new MockAiProvider());

    await expect(node.execute({}, {}, ctx)).rejects.toThrow(
      "AiTransformNode requires a prompt"
    );
  });

  it("propagates provider errors", async () => {
    const provider: IAiProvider = {
      name: "failing",
      complete: async () => { throw new Error("Provider down"); },
    };
    const node = new AiTransformNode(provider);

    await expect(
      node.execute({}, { prompt: "Do something" }, ctx)
    ).rejects.toThrow("Provider down");
  });

  it("MockAiProvider works end-to-end without real API calls", async () => {
    const node = new AiTransformNode(new MockAiProvider());

    const output = await node.execute(
      { value: 42 },
      { prompt: "Summarise: {{input}}" },
      ctx
    );

    const data = output.data as Record<string, unknown>;
    expect(typeof data["result"]).toBe("string");
    expect((data["result"] as string).startsWith("[Mock AI]")).toBe(true);
    expect(data["tokensUsed"]).toBe(10);
    expect(data["model"]).toBe("mock-1.0");
  });
});
