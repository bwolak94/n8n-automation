import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { TelegramNode } from "../../nodes/implementations/TelegramNode.js";
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

describe("TelegramNode", () => {
  const node = new TelegramNode();
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("has correct definition type", () => {
    expect(node.definition.type).toBe("telegram");
  });

  it("throws when botToken is missing", async () => {
    await expect(
      node.execute({}, { chatId: "123", text: "hi" }, ctx)
    ).rejects.toThrow("Telegram: botToken is required");
  });

  it("throws when chatId is missing", async () => {
    await expect(
      node.execute({}, { botToken: "tok", text: "hi" }, ctx)
    ).rejects.toThrow("Telegram: chatId is required");
  });

  it("POSTs to correct Telegram API URL", async () => {
    fetchSpy.mockResolvedValue(
      mockJsonResponse(200, { ok: true, result: { message_id: 1 } })
    );

    await node.execute({}, { botToken: "abc123", chatId: "chat-1", text: "Hello" }, ctx);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.telegram.org/botabc123/sendMessage",
      expect.objectContaining({ method: "POST" })
    );
    expect(captureBody(fetchSpy)["chat_id"]).toBe("chat-1");
    expect(captureBody(fetchSpy)["text"]).toBe("Hello");
  });

  it("includes parseMode and disableNotification when provided", async () => {
    fetchSpy.mockResolvedValue(
      mockJsonResponse(200, { ok: true, result: {} })
    );

    await node.execute(
      {},
      {
        botToken: "tok",
        chatId: "cid",
        text: "msg",
        parseMode: "MarkdownV2",
        disableNotification: true,
      },
      ctx
    );

    const body = captureBody(fetchSpy);
    expect(body["parse_mode"]).toBe("MarkdownV2");
    expect(body["disable_notification"]).toBe(true);
  });

  it("throws AppError when Telegram returns ok: false", async () => {
    fetchSpy.mockResolvedValue(
      mockJsonResponse(200, { ok: false, description: "Bad Request: chat not found" })
    );

    await expect(
      node.execute({}, { botToken: "tok", chatId: "bad", text: "hi" }, ctx)
    ).rejects.toThrow("Telegram API error: Bad Request: chat not found");
  });

  it("throws with 'unknown' description when none provided", async () => {
    fetchSpy.mockResolvedValue(mockJsonResponse(200, { ok: false }));

    await expect(
      node.execute({}, { botToken: "tok", chatId: "cid", text: "hi" }, ctx)
    ).rejects.toThrow("Telegram API error: unknown");
  });

  it("returns result on success", async () => {
    const result = { message_id: 42, text: "Hello" };
    fetchSpy.mockResolvedValue(
      mockJsonResponse(200, { ok: true, result })
    );

    const output = await node.execute(
      {},
      { botToken: "tok", chatId: "cid", text: "Hello" },
      ctx
    );

    expect(output.data).toEqual(result);
  });

  it("returns empty object when result is undefined", async () => {
    fetchSpy.mockResolvedValue(mockJsonResponse(200, { ok: true }));

    const output = await node.execute(
      {},
      { botToken: "tok", chatId: "cid", text: "hi" },
      ctx
    );

    expect(output.data).toEqual({});
  });
});
