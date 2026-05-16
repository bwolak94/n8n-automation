import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { DiscordNode } from "../../nodes/implementations/DiscordNode.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

const ctx: ExecutionContext = {
  tenantId: "t-1",
  executionId: "exec-1",
  workflowId: "wf-1",
  variables: {},
};

function mockResponse(status: number, body = ""): Response {
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

describe("DiscordNode", () => {
  const node = new DiscordNode();
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("has correct definition type", () => {
    expect(node.definition.type).toBe("discord");
  });

  it("throws when webhookUrl is missing", async () => {
    await expect(node.execute({}, { content: "hi" }, ctx)).rejects.toThrow(
      "Discord: webhookUrl is required"
    );
  });

  it("throws when neither content nor embeds are provided", async () => {
    await expect(
      node.execute({}, { webhookUrl: "https://discord.com/webhook/test" }, ctx)
    ).rejects.toThrow("Discord: provide at least content or embeds");
  });

  it("POSTs JSON to webhookUrl with content", async () => {
    fetchSpy.mockResolvedValue(mockResponse(204));

    await node.execute(
      {},
      { webhookUrl: "https://discord.com/webhook/test", content: "Hello!" },
      ctx
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://discord.com/webhook/test",
      expect.objectContaining({ method: "POST" })
    );
    expect(captureBody(fetchSpy)["content"]).toBe("Hello!");
  });

  it("includes optional username and avatarUrl", async () => {
    fetchSpy.mockResolvedValue(mockResponse(204));

    await node.execute(
      {},
      {
        webhookUrl: "https://discord.com/webhook/test",
        content: "msg",
        username: "AutoBot",
        avatarUrl: "https://example.com/avatar.png",
      },
      ctx
    );

    const body = captureBody(fetchSpy);
    expect(body["username"]).toBe("AutoBot");
    expect(body["avatar_url"]).toBe("https://example.com/avatar.png");
  });

  it("sends embeds when content is absent", async () => {
    fetchSpy.mockResolvedValue(mockResponse(204));

    const embeds = [{ title: "Alert", description: "System down", color: 16711680 }];
    await node.execute(
      {},
      { webhookUrl: "https://discord.com/webhook/test", embeds },
      ctx
    );

    expect(captureBody(fetchSpy)["embeds"]).toEqual(embeds);
  });

  it("throws AppError on non-ok response", async () => {
    fetchSpy.mockResolvedValue(mockResponse(400, "Unknown Webhook"));

    await expect(
      node.execute({}, { webhookUrl: "https://discord.com/webhook/test", content: "hi" }, ctx)
    ).rejects.toThrow("Discord API error 400: Unknown Webhook");
  });

  it("returns { ok: true, status } on 204 success", async () => {
    fetchSpy.mockResolvedValue(mockResponse(204));

    const output = await node.execute(
      {},
      { webhookUrl: "https://discord.com/webhook/test", content: "hi" },
      ctx
    );

    expect((output.data as Record<string, unknown>)["ok"]).toBe(true);
    expect((output.data as Record<string, unknown>)["status"]).toBe(204);
  });
});
