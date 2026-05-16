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

// ─── Existing transport-injection tests (must remain green) ──────────────────

describe("EmailNode (injected transport)", () => {
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

  it("output includes success:true on successful send", async () => {
    const output = await node.execute({}, { to: "a@b.com", subject: "Hi" }, ctx);
    const data = output.data as Record<string, unknown>;
    expect(data["success"]).toBe(true);
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

// ─── CC / BCC / Reply-To ─────────────────────────────────────────────────────

describe("EmailNode — CC / BCC / Reply-To", () => {
  it("passes cc to transport", async () => {
    const transport = makeTransport();
    const node = new EmailNode(transport);

    await node.execute({}, { to: "a@b.com", subject: "Hi", cc: "c@b.com" }, ctx);

    const opts = (transport.sendMail.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(opts["cc"]).toBe("c@b.com");
  });

  it("passes bcc to transport", async () => {
    const transport = makeTransport();
    const node = new EmailNode(transport);

    await node.execute({}, { to: "a@b.com", subject: "Hi", bcc: "hidden@b.com" }, ctx);

    const opts = (transport.sendMail.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(opts["bcc"]).toBe("hidden@b.com");
  });

  it("passes replyTo to transport", async () => {
    const transport = makeTransport();
    const node = new EmailNode(transport);

    await node.execute({}, { to: "a@b.com", subject: "Hi", replyTo: "reply@b.com" }, ctx);

    const opts = (transport.sendMail.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(opts["replyTo"]).toBe("reply@b.com");
  });
});

// ─── Dry-run mode ─────────────────────────────────────────────────────────────

describe("EmailNode — dry-run mode", () => {
  it("returns success without calling transport when dryRun is true", async () => {
    const transport = makeTransport();
    const node = new EmailNode(transport);

    const output = await node.execute(
      {},
      { to: "a@b.com", subject: "Test", dryRun: true },
      ctx
    );

    expect(transport.sendMail).not.toHaveBeenCalled();
    const data = output.data as Record<string, unknown>;
    expect(data["success"]).toBe(true);
    expect(data["dryRun"]).toBe(true);
    expect(typeof data["messageId"]).toBe("string");
  });
});

// ─── Attachment size limit ────────────────────────────────────────────────────

describe("EmailNode — attachment size limit", () => {
  it("throws when attachment exceeds maxAttachmentBytes", async () => {
    const transport = makeTransport();
    const node = new EmailNode(transport);

    const bigContent = "x".repeat(200); // will exceed 100-byte limit

    await expect(
      node.execute(
        {},
        {
          to: "a@b.com",
          subject: "Big attachment",
          attachments: [{ filename: "big.txt", content: bigContent }],
          maxAttachmentBytes: 100,
        },
        ctx
      )
    ).rejects.toThrow("exceeds the");
  });

  it("accepts attachment within size limit", async () => {
    const transport = makeTransport();
    const node = new EmailNode(transport);

    await expect(
      node.execute(
        {},
        {
          to: "a@b.com",
          subject: "Small attachment",
          attachments: [{ filename: "small.txt", content: "tiny" }],
          maxAttachmentBytes: 1000,
        },
        ctx
      )
    ).resolves.toBeDefined();
  });
});

// ─── Transport error handling ─────────────────────────────────────────────────

describe("EmailNode — transport error handling", () => {
  it("returns success:false and friendly error on SMTP auth failure", async () => {
    const failTransport: IEmailTransport = {
      sendMail: jest.fn<IEmailTransport["sendMail"]>().mockRejectedValue(
        new Error("535 Authentication failed")
      ),
    };
    const node = new EmailNode(failTransport);

    const output = await node.execute({}, { to: "a@b.com", subject: "Test" }, ctx);
    const data = output.data as Record<string, unknown>;

    expect(data["success"]).toBe(false);
    expect(typeof data["error"]).toBe("string");
    expect(data["error"] as string).toContain("authentication");
  });

  it("returns success:false and friendly error on ECONNREFUSED", async () => {
    const failTransport: IEmailTransport = {
      sendMail: jest.fn<IEmailTransport["sendMail"]>().mockRejectedValue(
        new Error("ECONNREFUSED 127.0.0.1:587")
      ),
    };
    const node = new EmailNode(failTransport);

    const output = await node.execute({}, { to: "a@b.com", subject: "Test" }, ctx);
    const data = output.data as Record<string, unknown>;

    expect(data["success"]).toBe(false);
    expect(data["error"] as string).toContain("connect");
  });

  it("does not include credential values in error output", async () => {
    const failTransport: IEmailTransport = {
      sendMail: jest.fn<IEmailTransport["sendMail"]>().mockRejectedValue(
        new Error("timeout")
      ),
    };
    const node = new EmailNode(failTransport);

    const output = await node.execute(
      {},
      { to: "a@b.com", subject: "Test", smtpPassword: "super-secret-password" },
      ctx
    );
    const data = output.data as Record<string, unknown>;

    expect(JSON.stringify(data)).not.toContain("super-secret-password");
  });
});

// ─── Node definition ──────────────────────────────────────────────────────────

describe("EmailNode — definition", () => {
  const node = new EmailNode();

  it("has type 'email'", () => {
    expect(node.definition.type).toBe("email");
  });

  it("has configSchema with required fields", () => {
    const schema = node.definition.configSchema as Record<string, unknown>;
    const required = schema["required"] as string[];
    expect(required).toContain("to");
    expect(required).toContain("subject");
  });
});
