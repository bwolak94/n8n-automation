export type BackoffStrategy = "exponential" | "linear" | "fixed";

export interface RetryConfig {
  readonly maxAttempts: number;
  readonly backoffStrategy: BackoffStrategy;
  readonly backoffDelay: number;
  /** If provided, only retry when the thrown error is an instance of one of these classes. */
  readonly retryOn?: ReadonlyArray<new (...args: never[]) => Error>;
}

export interface FailedJob {
  readonly nodeId: string;
  readonly executionId: string;
  readonly tenantId: string;
  readonly error: Error;
  readonly attempts: number;
  readonly payload: unknown;
}

export interface IDLQueue {
  add(job: FailedJob): Promise<void>;
}

type SleepFn = (ms: number) => Promise<void>;

/* istanbul ignore next */
const defaultSleep: SleepFn = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class RetryManager {
  constructor(
    private readonly dlq: IDLQueue,
    private readonly sleep: SleepFn = defaultSleep
  ) {}

  async execute<T>(
    fn: () => Promise<T>,
    config: RetryConfig,
    jobContext: Omit<FailedJob, "error" | "attempts">
  ): Promise<T> {
    let lastError!: Error;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        const isRetryable =
          !config.retryOn || this.isRetryable(lastError, config.retryOn);

        if (!isRetryable) {
          await this.dlq.add({ ...jobContext, error: lastError, attempts: attempt });
          throw lastError;
        }

        if (attempt < config.maxAttempts) {
          await this.sleep(this.calculateDelay(attempt, config));
        }
      }
    }

    await this.dlq.add({
      ...jobContext,
      error: lastError,
      attempts: config.maxAttempts,
    });
    throw lastError;
  }

  private isRetryable(
    error: Error,
    retryOn: ReadonlyArray<new (...args: never[]) => Error>
  ): boolean {
    return retryOn.some((ErrorClass) => error instanceof ErrorClass);
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    switch (config.backoffStrategy) {
      case "exponential":
        return config.backoffDelay * Math.pow(2, attempt - 1);
      case "linear":
        return config.backoffDelay * attempt;
      case "fixed":
        return config.backoffDelay;
    }
  }
}
