import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { HttpRequestNode } from "../../nodes/implementations/HttpRequestNode.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ctx: ExecutionContext = {
  tenantId: "t-1",
  executionId: "exec-1",
  workflowId: "wf-1",
  variables: {},
};

function mockResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      forEach: (cb: (value: string, key: string) => void) => {
        Object.entries(headers).forEach(([k, v]) => cb(v, k));
      },
    },
    text: jest.fn<() => Promise<string>>().mockResolvedValue(text),
  } as unknown as Response;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("HttpRequestNode", () => {
  const node = new HttpRequestNode();
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("has correct definition type", () => {
    expect(node.definition.type).toBe("http");
  });

  it("defaults to GET method", async () => {
    fetchSpy.mockResolvedValue(mockResponse(200, {}));

    await node.execute({}, { url: "https://api.example.com" }, ctx);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.example.com",
      expect.objectContaining({ method: "GET" })
    );
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "sends %s request",
    async (method) => {
      fetchSpy.mockResolvedValue(mockResponse(200, {}));

      await node.execute({}, { url: "https://example.com", method }, ctx);

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({ method })
      );
    }
  );

  it("injects Bearer auth header", async () => {
    fetchSpy.mockResolvedValue(mockResponse(200, {}));

    await node.execute(
      {},
      {
        url: "https://example.com",
        auth: { type: "bearer", token: "tok-123" },
      },
      ctx
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer tok-123",
        }),
      })
    );
  });

  it("injects Basic auth header", async () => {
    fetchSpy.mockResolvedValue(mockResponse(200, {}));

    await node.execute(
      {},
      {
        url: "https://example.com",
        auth: { type: "basic", username: "alice", password: "secret" },
      },
      ctx
    );

    const expected = `Basic ${Buffer.from("alice:secret").toString("base64")}`;
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: expected }),
      })
    );
  });

  it("returns statusCode, headers, body, durationMs on success", async () => {
    fetchSpy.mockResolvedValue(
      mockResponse(200, { id: 42 }, { "content-type": "application/json" })
    );

    const output = await node.execute(
      {},
      { url: "https://example.com" },
      ctx
    );
    const data = output.data as Record<string, unknown>;

    expect(data["statusCode"]).toBe(200);
    expect(data["body"]).toEqual({ id: 42 });
    expect(data["headers"]).toEqual({ "content-type": "application/json" });
    expect(typeof data["durationMs"]).toBe("number");
  });

  it("returns plain text body when JSON parse fails", async () => {
    fetchSpy.mockResolvedValue(mockResponse(200, "plain text"));

    const output = await node.execute({}, { url: "https://example.com" }, ctx);
    expect((output.data as Record<string, unknown>)["body"]).toBe("plain text");
  });

  it("throws AppError on 4xx response", async () => {
    fetchSpy.mockResolvedValue(mockResponse(404, "Not Found"));

    await expect(
      node.execute({}, { url: "https://example.com" }, ctx)
    ).rejects.toThrow("HTTP request failed with status 404");
  });

  it("throws AppError on 5xx response", async () => {
    fetchSpy.mockResolvedValue(mockResponse(500, "Error"));

    await expect(
      node.execute({}, { url: "https://example.com" }, ctx)
    ).rejects.toThrow("HTTP request failed with status 500");
  });

  it("throws AppError when url is missing", async () => {
    await expect(node.execute({}, {}, ctx)).rejects.toThrow(
      "HttpRequestNode requires a url"
    );
  });

  it("serialises object body as JSON and sets Content-Type for POST", async () => {
    fetchSpy.mockResolvedValue(mockResponse(201, {}));

    await node.execute(
      {},
      { url: "https://example.com", method: "POST", body: { key: "val" } },
      ctx
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({
        body: JSON.stringify({ key: "val" }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("sends string body as-is", async () => {
    fetchSpy.mockResolvedValue(mockResponse(200, {}));

    await node.execute(
      {},
      { url: "https://example.com", method: "POST", body: "raw string" },
      ctx
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({ body: "raw string" })
    );
  });

  it("passes custom headers to fetch", async () => {
    fetchSpy.mockResolvedValue(mockResponse(200, {}));

    await node.execute(
      {},
      {
        url: "https://example.com",
        headers: { "X-Custom": "value" },
      },
      ctx
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Custom": "value" }),
      })
    );
  });
});
