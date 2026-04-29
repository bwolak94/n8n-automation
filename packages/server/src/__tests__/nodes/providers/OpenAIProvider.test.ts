import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { OpenAIProvider } from "../../../nodes/ai/OpenAIProvider.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeOkResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: jest.fn<() => Promise<unknown>>().mockResolvedValue(body),
  } as unknown as Response;
}

function makeErrorResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: jest.fn<() => Promise<unknown>>().mockResolvedValue({
      error: { message: `Error ${status}` },
    }),
  } as unknown as Response;
}

const successBody = {
  model: "gpt-4o",
  choices: [{ message: { content: "Hello from GPT" } }],
  usage: { total_tokens: 35 },
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("OpenAIProvider", () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("has name 'openai'", () => {
    expect(new OpenAIProvider("key").name).toBe("openai");
  });

  it("calls the OpenAI endpoint and maps response", async () => {
    fetchSpy.mockResolvedValue(makeOkResponse(successBody));
    const provider = new OpenAIProvider("test-key");

    const response = await provider.complete({
      model: "gpt-4o",
      prompt: "Hello",
    });

    expect(response.result).toBe("Hello from GPT");
    expect(response.tokensUsed).toBe(35);
    expect(response.model).toBe("gpt-4o");
  });

  it("includes system prompt as first message when provided", async () => {
    fetchSpy.mockResolvedValue(makeOkResponse(successBody));
    const provider = new OpenAIProvider("test-key");

    await provider.complete({
      model: "gpt-4o",
      prompt: "Summarise",
      systemPrompt: "Be brief.",
    });

    const fetchOptions = (fetchSpy.mock.calls[0] as [string, RequestInit])[1];
    const parsedBody = JSON.parse(fetchOptions.body as string) as {
      messages: Array<{ role: string; content: string }>;
    };

    expect(parsedBody.messages[0]).toEqual({
      role: "system",
      content: "Be brief.",
    });
    expect(parsedBody.messages[1]).toEqual({
      role: "user",
      content: "Summarise",
    });
  });

  it("uses the custom baseUrl when provided", async () => {
    fetchSpy.mockResolvedValue(makeOkResponse(successBody));
    const provider = new OpenAIProvider("key", "https://my-proxy.example.com");

    await provider.complete({ model: "gpt-4o", prompt: "Hi" });

    const url = (fetchSpy.mock.calls[0] as [string, RequestInit])[0];
    expect(url).toContain("https://my-proxy.example.com");
  });

  it("throws AI_RATE_LIMITED on 429", async () => {
    fetchSpy.mockResolvedValue(makeErrorResponse(429));
    const provider = new OpenAIProvider("key");

    await expect(
      provider.complete({ model: "gpt-4o", prompt: "Hi" })
    ).rejects.toMatchObject({ code: "AI_RATE_LIMITED", statusCode: 429 });
  });

  it("throws AI_AUTH_FAILED on 401", async () => {
    fetchSpy.mockResolvedValue(makeErrorResponse(401));
    const provider = new OpenAIProvider("bad-key");

    await expect(
      provider.complete({ model: "gpt-4o", prompt: "Hi" })
    ).rejects.toMatchObject({ code: "AI_AUTH_FAILED", statusCode: 401 });
  });

  it("throws AI_PROVIDER_ERROR on other non-ok statuses", async () => {
    fetchSpy.mockResolvedValue(makeErrorResponse(503));
    const provider = new OpenAIProvider("key");

    await expect(
      provider.complete({ model: "gpt-4o", prompt: "Hi" })
    ).rejects.toMatchObject({ code: "AI_PROVIDER_ERROR" });
  });
});
