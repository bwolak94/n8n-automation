import { AppError } from "../../shared/errors/index.js";
import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";

interface HttpAuth {
  readonly type: "bearer" | "basic";
  readonly token?: string;
  readonly username?: string;
  readonly password?: string;
}

interface HttpConfig {
  readonly url: string;
  readonly method?: string;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
  readonly auth?: HttpAuth;
  readonly followRedirects?: boolean;
  readonly timeoutMs?: number;
}

function buildAuthHeader(auth: HttpAuth): string {
  if (auth.type === "bearer") {
    return `Bearer ${auth.token ?? ""}`;
  }
  const credentials = Buffer.from(
    `${auth.username ?? ""}:${auth.password ?? ""}`
  ).toString("base64");
  return `Basic ${credentials}`;
}

export class HttpRequestNode implements INode {
  readonly definition: NodeDefinition = {
    type: "http",
    name: "HTTP Request",
    description: "Make an HTTP request to any URL",
    configSchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string", format: "uri" },
        method: {
          type: "string",
          enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
          default: "GET",
        },
        headers: { type: "object", additionalProperties: { type: "string" } },
        body: {},
        auth: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["bearer", "basic"] },
            token: { type: "string" },
            username: { type: "string" },
            password: { type: "string" },
          },
        },
        followRedirects: { type: "boolean", default: true },
        timeoutMs: { type: "number", default: 30000 },
      },
    },
  };

  async execute(
    _input: unknown,
    config: Readonly<Record<string, unknown>>,
    context: ExecutionContext
  ): Promise<NodeOutput> {
    const {
      url,
      method = "GET",
      headers = {},
      body,
      auth,
      followRedirects = true,
      timeoutMs = 30_000,
    } = config as HttpConfig;

    if (!url) {
      throw new AppError(
        "HttpRequestNode requires a url",
        400,
        "HTTP_MISSING_URL"
      );
    }

    const requestHeaders: Record<string, string> = { ...(headers as Record<string, string>) };

    if (auth) {
      requestHeaders["Authorization"] = buildAuthHeader(auth as HttpAuth);
    }

    const upperMethod = (method as string).toUpperCase();
    const hasBody =
      body !== undefined && !["GET", "HEAD"].includes(upperMethod);

    if (hasBody && typeof body !== "string") {
      requestHeaders["Content-Type"] ??= "application/json";
    }

    const signal =
      context.signal ?? AbortSignal.timeout(timeoutMs as number);

    const startedAt = Date.now();

    const response = await fetch(url as string, {
      method: upperMethod,
      headers: requestHeaders,
      redirect: (followRedirects as boolean) ? "follow" : "manual",
      signal,
      body: hasBody
        ? typeof body === "string"
          ? body
          : JSON.stringify(body)
        : undefined,
    });

    const durationMs = Date.now() - startedAt;

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const text = await response.text();
    const responseBody = (() => {
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return text;
      }
    })();

    if (!response.ok) {
      throw new AppError(
        `HTTP request failed with status ${response.status}`,
        response.status,
        "HTTP_REQUEST_FAILED"
      );
    }

    return {
      data: {
        statusCode: response.status,
        headers: responseHeaders,
        body: responseBody,
        durationMs,
      },
    };
  }
}
