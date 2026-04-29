export interface DLQEntry {
  readonly id: string;
  readonly data: unknown;
  readonly errorMessage: string;
  readonly retryCount: number;
  readonly failedAt: Date;
}

export interface IDLQRepository {
  list(
    offset: number,
    limit: number
  ): Promise<{ items: DLQEntry[]; total: number }>;
  retry(jobId: string): Promise<void>;
  discard(jobId: string): Promise<void>;
}
