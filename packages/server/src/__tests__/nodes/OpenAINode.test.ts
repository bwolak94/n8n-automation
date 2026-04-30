import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { OpenAINode } from "../../nodes/implementations/OpenAINode.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

const ctx: ExecutionContext = {
  tenantId: "t-1",
  executionId: "exec-1",
  workflowId: "wf-1",
  variables: {},
};

function mockJsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn<() => Promise<unknown>>().mockResolvedValue(body),
  } as unknown as Response;
}

function captureBody(spy: jest.SpiedFunction<typeof fetch>): Record<string, unknown> {
  const init = (spy.mock.calls[0] as [string, RequestInit])[1];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

const successResponse = {
  choices: [{ message: { content: "Paris" } }],
};

describe("OpenAINode", () => {
  const node = new OpenAINode();
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("has correct definition type", () => {
    expect(node.definition.type).toBe("openai");
  });

  it("throws when apiKey is missing", async () => {
    await expect(node.execute({}, { prompt: "hi" }, ctx)).rejects.toThrow(
      "OpenAI: apiKey is required"
    );
  });

  it("throws when prompt is missing", async () => {
    await expect(node.execute({}, { apiKey: "sk-test" }, ctx)).rejects.toThrow(
      "OpenAI: prompt is required"
    );
  });

  it("POSTs to OpenAI chat completions endpoint with Bearer auth", async () => {
    fetchSpy.mockResolvedValue(mockJsonResponse(200, successResponse));

    await node.execute({}, { apiKey: "sk-test", prompt: "What is 2+2?" }, ctx);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer sk-test" }),
      })
    );
  });

  it("sends user message in messages array", async () => {
    fetchSpy.mockResolvedValue(mockJsonResponse(200, successResponse));

    await node.execute({}, { apiKey: "sk-test", prompt: "Hello" }, ctx);

    const body = captureBody(fetchSpy);
    expect(body["messages"]).toEqual([{ role: "user", content: "Hello" }]);
  });

  it("prepends system message when systemPrompt is provided", async () => {
    fetchSpy.mockResolvedValue(mockJsonResponse(200, successResponse));

    await node.execute(
      {},
      { apiKey: "sk-test", prompt: "Translate to Spanish", systemPrompt: "You are a translator." },
      ctx
    );

    const messages = captureBody(fetchSpy)["messages"] as Array<{ role: string; content: string }>;
    expect(messages[0]).toEqual({ role: "system", content: "You are a translator." });
    expect(messages[1]).toEqual({ role: "user", content: "Translate to Spanish" });
  });

  it("uses default model gpt-4o-mini when not specified", async () => {
    fetchSpy.mockResolvedValue(mockJsonResponse(200, successResponse));

    await node.execute({}, { apiKey: "sk-test", prompt: "hi" }, ctx);

    expect(captureBody(fetchSpy)["model"]).toBe("gpt-4o-mini");
  });

  it("uses custom model when specified", async () => {
    fetchSpy.mockResolvedValue(mockJsonResponse(200, {
      choices: [{ message: { content: "answer" } }],
    }));

    await node.execute({}, { apiKey: "sk-test", prompt: "hi", model: "gpt-4o" }, ctx);

    expect(captureBody(fetchSpy)["model"]).toBe("gpt-4o");
  });

  it("throws AppError on API error response", async () => {
    fetchSpy.mockResolvedValue(
      mockJsonResponse(401, { error: { message: "Invalid API key" } })
    );

    await expect(
      node.execute({}, { apiKey: "bad-key", prompt: "hi" }, ctx)
    ).rejects.toThrow("OpenAI API error 401: Invalid API key");
  });

  it("throws with 'unknown' when error message is missing", async () => {
    fetchSpy.mockResolvedValue(mockJsonResponse(500, {}));

    await expect(
      node.execute({}, { apiKey: "sk-test", prompt: "hi" }, ctx)
    ).rejects.toThrow("OpenAI API error 500: unknown");
  });

  it("returns text and model from response", async () => {
    fetchSpy.mockResolvedValue(
      mockJsonResponse(200, { choices: [{ message: { content: "Paris" } }] })
    );

    const output = await node.execute(
      {},
      { apiKey: "sk-test", prompt: "Capital of France?", model: "gpt-4o" },
      ctx
    );

    expect((output.data as Record<string, unknown>)["text"]).toBe("Paris");
    expect((output.data as Record<string, unknown>)["model"]).toBe("gpt-4o");
  });

  it("returns empty text when choices are missing", async () => {
    fetchSpy.mockResolvedValue(mockJsonResponse(200, { choices: [] }));

    const output = await node.execute({}, { apiKey: "sk-test", prompt: "hi" }, ctx);

    expect((output.data as Record<string, unknown>)["text"]).toBe("");
  });
});
