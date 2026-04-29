import { AppError } from "../shared/errors/index.js";

interface WebhookRegistration {
  readonly path: string;
  readonly method: string;
}

export class WebhookRegistry {
  private readonly registrations = new Map<string, WebhookRegistration>();

  register(path: string, method: string): void {
    const key = `${method.toUpperCase()}:${path}`;
    if (this.registrations.has(key)) {
      throw new AppError(
        `Webhook already registered: ${method.toUpperCase()} ${path}`,
        409,
        "WEBHOOK_DUPLICATE_PATH"
      );
    }
    this.registrations.set(key, { path, method: method.toUpperCase() });
  }

  has(path: string, method: string): boolean {
    return this.registrations.has(`${method.toUpperCase()}:${path}`);
  }

  unregister(path: string, method: string): void {
    this.registrations.delete(`${method.toUpperCase()}:${path}`);
  }
}
