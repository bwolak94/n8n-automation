import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { AIPromptNode } from "../../nodes/implementations/AIPromptNode.js";
import type { PromptProviderFactory } from "../../nodes/implementations/AIPromptNode.js";
import type { ICredentialVault } from "../../nodes/implementations/DatabaseNode.js";
import type { IPromptProvider, PromptMessage, PromptConfig, PromptResult } from "../../nodes/ai/IPromptProvider.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCtx(): ExecutionContext {
  return { tenantId: "t-1", executionId: "e-1", workflowId: "wf-1", variables: {} };
}

function makeVault(apiKey = "sk-test"): ICredentialVault {
  return {
    getCredentialData: jest.fn<() => Promise<Record<string, string>>>().mockResolvedValue({ apiKey }),
  };
}

function baseConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    provider: "anthropic",
    credentialId: "cred-1",
    model: "claude-sonnet-4-6",
    messages: [{ role: "user", content: "Hello" }],
    responseFormat: "text",
    ...overrides,
  };
}

/** Creates a mock provider that returns the given content and token counts. */
function makeProvider(
  content = "response text",
  inputTokens = 10,
  outputTokens = 5
): IPromptProvider {
  return {
    complete: jest.fn<(s: string | undefined, m: PromptMessage[], c: PromptConfig) => Promise<PromptResult>>()
      .mockResolvedValue({ content, usage: { inputTokens, outputTokens } }),
  };
}

/** Creates an AIPromptNode with an injected mock provider factory. */
function makeNode(
  provider: IPromptProvider,
  vault?: ICredentialVault
): AIPromptNode {
  const factory: PromptProviderFactory = () => provider;
  return new AIPromptNode(vault ?? makeVault(), factory);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AIPromptNode", () => {
  let mockProvider: IPromptProvider;
  let node: AIPromptNode;

  beforeEach(() => {
    mockProvider = makeProvider();
    node = makeNode(mockProvider);
  });

  // ── Definition ──────────────────────────────────────────────────────────────

  it("has type 'ai_prompt'", () => {
    expect(node.definition.type).toBe("ai_prompt");
  });

  // ── Config validation ────────────────────────────────────────────────────────

  it("throws AI_PROMPT_INVALID_CONFIG when messages array is empty", async () => {
    await expect(
      node.execute({}, baseConfig({ messages: [] }), makeCtx())
    ).rejects.toMatchObject({ code: "AI_PROMPT_INVALID_CONFIG" });
  });

  it("throws AI_PROMPT_INVALID_CONFIG when provider is unknown", async () => {
    await expect(
      node.execute({}, baseConfig({ provider: "unknown_llm" }), makeCtx())
    ).rejects.toMatchObject({ code: "AI_PROMPT_INVALID_CONFIG" });
  });

  it("throws AI_PROMPT_INVALID_CONFIG when credentialId is empty string", async () => {
    await expect(
      node.execute({}, baseConfig({ credentialId: "" }), makeCtx())
    ).rejects.toMatchObject({ code: "AI_PROMPT_INVALID_CONFIG" });
  });

  // ── Credential vault ────────────────────────────────────────────────────────

  it("throws AI_PROMPT_NO_VAULT when no vault is configured", async () => {
    const nodeNoVault = new AIPromptNode(undefined);
    await expect(
      nodeNoVault.execute({}, baseConfig(), makeCtx())
    ).rejects.toMatchObject({ code: "AI_PROMPT_NO_VAULT" });
  });

  it("throws AI_PROMPT_MISSING_KEY when credential has no apiKey or api_key field", async () => {
    const vault: ICredentialVault = {
      getCredentialData: jest.fn<() => Promise<Record<string, string>>>().mockResolvedValue({ host: "localhost" }),
    };
    const nodeWithBadVault = makeNode(mockProvider, vault);
    await expect(
      nodeWithBadVault.execute({}, baseConfig(), makeCtx())
    ).rejects.toMatchObject({ code: "AI_PROMPT_MISSING_KEY" });
  });

  it("accepts api_key (snake_case) credential field", async () => {
    const vault: ICredentialVault = {
      getCredentialData: jest.fn<() => Promise<Record<string, string>>>().mockResolvedValue({ api_key: "sk-snake" }),
    };
    const nodeSnake = makeNode(mockProvider, vault);
    const out = await nodeSnake.execute({}, baseConfig(), makeCtx());
    expect(out.data).toBeDefined();
  });

  // ── Message building ─────────────────────────────────────────────────────────

  it("passes systemPrompt and full message array to the provider", async () => {
    await node.execute(
      {},
      baseConfig({
        systemPrompt: "You are a helpful assistant",
        messages: [
          { role: "user", content: "Q1" },
          { role: "assistant", content: "A1" },
          { role: "user", content: "Q2" },
        ],
      }),
      makeCtx()
    );

    const complete = mockProvider.complete as ReturnType<typeof jest.fn>;
    expect(complete).toHaveBeenCalledTimes(1);
    const [sysArg, msgsArg] = complete.mock.calls[0] as [string, PromptMessage[], PromptConfig];
    expect(sysArg).toBe("You are a helpful assistant");
    expect(msgsArg).toHaveLength(3);
    expect(msgsArg[0]).toEqual({ role: "user", content: "Q1" });
    expect(msgsArg[1]).toEqual({ role: "assistant", content: "A1" });
    expect(msgsArg[2]).toEqual({ role: "user", content: "Q2" });
  });

  it("passes temperature and maxTokens from config to the provider", async () => {
    await node.execute(
      {},
      baseConfig({ temperature: 0.3, maxTokens: 512 }),
      makeCtx()
    );

    const complete = mockProvider.complete as ReturnType<typeof jest.fn>;
    const [, , providerConfig] = complete.mock.calls[0] as [string, PromptMessage[], PromptConfig];
    expect(providerConfig.temperature).toBe(0.3);
    expect(providerConfig.maxTokens).toBe(512);
  });

  // ── Sanitization ─────────────────────────────────────────────────────────────

  it("sanitizes residual {{ }} expressions in message content", async () => {
    await node.execute(
      {},
      baseConfig({ messages: [{ role: "user", content: "Inject {{nodes.x.secret}} here" }] }),
      makeCtx()
    );

    const complete = mockProvider.complete as ReturnType<typeof jest.fn>;
    const [, msgs] = complete.mock.calls[0] as [string, PromptMessage[], PromptConfig];
    expect(msgs[0]!.content).toBe("Inject [filtered] here");
  });

  it("sanitizes {{ }} in systemPrompt", async () => {
    await node.execute(
      {},
      baseConfig({ systemPrompt: "System {{leaked.key}}" }),
      makeCtx()
    );

    const complete = mockProvider.complete as ReturnType<typeof jest.fn>;
    const [sysArg] = complete.mock.calls[0] as [string, PromptMessage[], PromptConfig];
    expect(sysArg).toBe("System [filtered]");
  });

  // ── Response format ───────────────────────────────────────────────────────────

  it("returns raw string content for responseFormat=text", async () => {
    node = makeNode(makeProvider("hello world"));
    const out = await node.execute({}, baseConfig({ responseFormat: "text" }), makeCtx());
    expect((out.data as Record<string, unknown>)["content"]).toBe("hello world");
    expect((out.data as Record<string, unknown>)["rawContent"]).toBe("hello world");
  });

  it("parses JSON string to object for responseFormat=json", async () => {
    node = makeNode(makeProvider('{"category":"billing","priority":"high"}'));
    const out = await node.execute({}, baseConfig({ responseFormat: "json" }), makeCtx());
    expect((out.data as Record<string, unknown>)["content"]).toEqual({
      category: "billing",
      priority: "high",
    });
  });

  it("throws AI_PROMPT_INVALID_JSON when provider returns invalid JSON in json mode", async () => {
    node = makeNode(makeProvider("Here is my answer: billing"));
    await expect(
      node.execute({}, baseConfig({ responseFormat: "json" }), makeCtx())
    ).rejects.toMatchObject({ code: "AI_PROMPT_INVALID_JSON" });
  });

  it("throws AI_PROMPT_SCHEMA_MISMATCH when structured output is missing required fields", async () => {
    node = makeNode(makeProvider('{"category":"billing"}')); // missing 'priority'
    await expect(
      node.execute(
        {},
        baseConfig({
          responseFormat: "structured",
          jsonSchema: {
            type: "object",
            required: ["category", "priority"],
          },
        }),
        makeCtx()
      )
    ).rejects.toMatchObject({ code: "AI_PROMPT_SCHEMA_MISMATCH" });
  });

  it("throws AI_PROMPT_SCHEMA_MISMATCH when structured output is not an object but schema requires object", async () => {
    node = makeNode(makeProvider('"just a string"')); // valid JSON but wrong type
    await expect(
      node.execute(
        {},
        baseConfig({
          responseFormat: "structured",
          jsonSchema: { type: "object", required: ["key"] },
        }),
        makeCtx()
      )
    ).rejects.toMatchObject({ code: "AI_PROMPT_SCHEMA_MISMATCH" });
  });

  it("passes structured validation when all required fields are present", async () => {
    node = makeNode(makeProvider('{"category":"billing","priority":"high"}'));
    const out = await node.execute(
      {},
      baseConfig({
        responseFormat: "structured",
        jsonSchema: { type: "object", required: ["category", "priority"] },
      }),
      makeCtx()
    );
    expect((out.data as Record<string, unknown>)["responseFormat"]).toBe("structured");
  });

  // ── Token usage ───────────────────────────────────────────────────────────────

  it("records inputTokens, outputTokens and totalTokens in metadata", async () => {
    node = makeNode(makeProvider("ok", 150, 75));
    const out = await node.execute({}, baseConfig(), makeCtx());
    const usage = (out.metadata as Record<string, unknown>)?.["usage"] as Record<string, number>;
    expect(usage["inputTokens"]).toBe(150);
    expect(usage["outputTokens"]).toBe(75);
    expect(usage["totalTokens"]).toBe(225);
  });

  // ── Fallback provider ─────────────────────────────────────────────────────────

  it("uses fallback provider when primary throws and fallback is configured", async () => {
    const failingProvider: IPromptProvider = {
      complete: jest.fn<() => Promise<PromptResult>>().mockRejectedValue(new Error("primary down")),
    };
    const fallbackProviderInstance = makeProvider("fallback result");

    let callCount = 0;
    const factory: PromptProviderFactory = () => {
      callCount++;
      return callCount === 1 ? failingProvider : fallbackProviderInstance;
    };

    const fallbackVault: ICredentialVault = {
      getCredentialData: jest.fn<() => Promise<Record<string, string>>>()
        .mockResolvedValueOnce({ apiKey: "sk-primary" })
        .mockResolvedValueOnce({ apiKey: "sk-fallback" }),
    };

    const nodeWithFallback = new AIPromptNode(fallbackVault, factory);
    const out = await nodeWithFallback.execute(
      {},
      baseConfig({ fallbackProvider: "openai", fallbackCredentialId: "cred-fallback" }),
      makeCtx()
    );

    expect((out.data as Record<string, unknown>)["content"]).toBe("fallback result");
  });

  it("re-throws primary error when no fallback is configured", async () => {
    const failingProvider: IPromptProvider = {
      complete: jest.fn<() => Promise<PromptResult>>().mockRejectedValue(
        Object.assign(new Error("primary down"), { code: "AI_PROVIDER_ERROR" })
      ),
    };
    node = makeNode(failingProvider);
    await expect(
      node.execute({}, baseConfig(), makeCtx())
    ).rejects.toMatchObject({ message: "primary down" });
  });
});
