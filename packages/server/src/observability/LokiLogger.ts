export interface ILokiLogger {
  log(
    level: "info" | "warn" | "error",
    message: string,
    labels?: Record<string, string>,
    extra?: Record<string, unknown>
  ): void;
}

interface LokiStream {
  stream: Record<string, string>;
  values: [string, string][];
}

interface LokiPushPayload {
  streams: LokiStream[];
}

export class LokiLogger implements ILokiLogger {
  private readonly pushUrl: string;

  constructor(lokiUrl: string) {
    this.pushUrl = `${lokiUrl}/loki/api/v1/push`;
  }

  log(
    level: "info" | "warn" | "error",
    message: string,
    labels: Record<string, string> = {},
    extra: Record<string, unknown> = {}
  ): void {
    const stream: Record<string, string> = {
      app: "automation-hub",
      level,
      ...labels,
    };

    const logLine = JSON.stringify({ message, ...extra });
    const nanoseconds = `${Date.now()}000000`;

    const payload: LokiPushPayload = {
      streams: [{ stream, values: [[nanoseconds, logLine]] }],
    };

    // Fire-and-forget — never block the execution pipeline
    fetch(this.pushUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch((err: unknown) => {
      process.stderr.write(
        `[LokiLogger] Failed to push log: ${String(err)}\n`
      );
    });
  }
}

export class NoopLokiLogger implements ILokiLogger {
  log(): void {
    // intentionally empty — used when Loki is not configured
  }
}
