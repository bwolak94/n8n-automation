import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { SlackNode } from "../../nodes/implementations/SlackNode.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

const ctx: ExecutionContext = {
  tenantId: "t-1",
  executionId: "exec-1",
  workflowId: "wf-1",
  variables: {},
};

function mockTextResponse(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn<() => Promise<string>>().mockResolvedValue(body),
  } as unknown as Response;
}

function captureBody(spy: jest.SpiedFunction<typeof fetch>): Record<string, unknown> {
  const init = (spy.mock.calls[0] as [string, RequestInit])[1];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe("SlackNode", () => {
  const node = new SlackNode();
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("has correct definition type", () => {
    expect(node.definition.type).toBe("slack");
  });

  it("throws when webhookUrl is missing", async () => {
    await expect(node.execute({}, { text: "hello" }, ctx)).rejects.toThrow(
      "Slack: webhookUrl is required"
    );
  });

  it("POSTs JSON payload to webhookUrl", async () => {
    fetchSpy.mockResolvedValue(mockTextResponse(200, "ok"));

    await node.execute({}, { webhookUrl: "https://hooks.slack.com/test", text: "Hello!" }, ctx);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://hooks.slack.com/test",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(captureBody(fetchSpy)["text"]).toBe("Hello!");
  });

  it("includes optional fields in payload when provided", async () => {
    fetchSpy.mockResolvedValue(mockTextResponse(200, "ok"));

    await node.execute(
      {},
      {
        webhookUrl: "https://hooks.slack.com/test",
        text: "Alert!",
        channel: "#alerts",
        username: "Bot",
        iconEmoji: ":robot_face:",
        attachments: [{ text: "detail" }],
      },
      ctx
    );

    const body = captureBody(fetchSpy);
    expect(body["channel"]).toBe("#alerts");
    expect(body["username"]).toBe("Bot");
    expect(body["icon_emoji"]).toBe(":robot_face:");
    expect(body["attachments"]).toEqual([{ text: "detail" }]);
  });

  it("throws AppError on non-ok response", async () => {
    fetchSpy.mockResolvedValue(mockTextResponse(500, "channel_not_found"));

    await expect(
      node.execute({}, { webhookUrl: "https://hooks.slack.com/test", text: "hi" }, ctx)
    ).rejects.toThrow("Slack API error 500: channel_not_found");
  });

  it("returns { ok: true, response } on success", async () => {
    fetchSpy.mockResolvedValue(mockTextResponse(200, "ok"));

    const output = await node.execute(
      {},
      { webhookUrl: "https://hooks.slack.com/test", text: "hi" },
      ctx
    );

    expect((output.data as Record<string, unknown>)["ok"]).toBe(true);
    expect((output.data as Record<string, unknown>)["response"]).toBe("ok");
  });
});
