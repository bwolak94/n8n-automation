import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { EmailNode } from "../../nodes/implementations/EmailNode.js";
import type { IEmailTransport, SentInfo } from "../../nodes/implementations/EmailNode.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ctx: ExecutionContext = {
  tenantId: "t-1",
  executionId: "exec-1",
  workflowId: "wf-1",
  variables: {},
};

function makeTransport(
  overrides: Partial<SentInfo> = {}
): IEmailTransport & { sendMail: jest.Mock } {
  return {
    sendMail: jest
      .fn<IEmailTransport["sendMail"]>()
      .mockResolvedValue({
        messageId: "msg-abc-123",
        accepted: ["user@example.com"],
        rejected: [],
        ...overrides,
      }),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("EmailNode", () => {
  let transport: ReturnType<typeof makeTransport>;
  let node: EmailNode;

  beforeEach(() => {
    transport = makeTransport();
    node = new EmailNode(transport);
  });

  it("has correct definition type", () => {
    expect(node.definition.type).toBe("email");
  });

  it("sends email and returns messageId, accepted, rejected", async () => {
    const output = await node.execute(
      {},
      { to: "user@example.com", subject: "Hello" },
      ctx
    );

    const data = output.data as Record<string, unknown>;
    expect(data["messageId"]).toBe("msg-abc-123");
    expect(data["accepted"]).toEqual(["user@example.com"]);
    expect(data["rejected"]).toEqual([]);
  });

  it("passes plain-text body to transport", async () => {
    await node.execute(
      {},
      { to: "a@b.com", subject: "Test", text: "Plain text body" },
      ctx
    );

    const opts = (transport.sendMail.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(opts["text"]).toBe("Plain text body");
  });

  it("passes HTML body to transport", async () => {
    await node.execute(
      {},
      { to: "a@b.com", subject: "Test", html: "<p>Hello</p>" },
      ctx
    );

    const opts = (transport.sendMail.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(opts["html"]).toBe("<p>Hello</p>");
  });

  it("accepts array of recipients", async () => {
    const recipients = ["a@example.com", "b@example.com"];
    await node.execute({}, { to: recipients, subject: "Bulk" }, ctx);

    const opts = (transport.sendMail.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(opts["to"]).toEqual(recipients);
  });

  it("passes from address to transport", async () => {
    await node.execute(
      {},
      { to: "a@b.com", subject: "Hi", from: "sender@example.com" },
      ctx
    );

    const opts = (transport.sendMail.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(opts["from"]).toBe("sender@example.com");
  });

  it("passes attachments to transport", async () => {
    const attachments = [{ filename: "doc.txt", content: "file content" }];
    await node.execute(
      {},
      { to: "a@b.com", subject: "With attachment", attachments },
      ctx
    );

    const opts = (transport.sendMail.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(opts["attachments"]).toEqual(attachments);
  });

  it("tracks rejected recipients", async () => {
    transport = makeTransport({
      accepted: ["ok@example.com"],
      rejected: ["bad@example.com"],
    });
    node = new EmailNode(transport);

    const output = await node.execute(
      {},
      { to: ["ok@example.com", "bad@example.com"], subject: "Test" },
      ctx
    );

    const data = output.data as Record<string, unknown>;
    expect(data["accepted"]).toEqual(["ok@example.com"]);
    expect(data["rejected"]).toEqual(["bad@example.com"]);
  });

  it("throws AppError when 'to' is missing", async () => {
    await expect(
      node.execute({}, { subject: "No recipient" }, ctx)
    ).rejects.toThrow("EmailNode requires a 'to' address");
  });

  it("throws AppError when 'subject' is missing", async () => {
    await expect(
      node.execute({}, { to: "a@b.com" }, ctx)
    ).rejects.toThrow("EmailNode requires a 'subject'");
  });
});
