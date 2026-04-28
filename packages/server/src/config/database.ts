import mongoose from "mongoose";
import { Pool } from "pg";
import { env } from "./env.js";

const RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 2000;

export async function connectWithRetry(
  connectFn: () => Promise<void>,
  name: string,
  attempts: number = RETRY_ATTEMPTS,
  delayMs: number = RETRY_DELAY_MS
): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await connectFn();
      console.log(`[${name}] Connected`);
      return;
    } catch (error) {
      if (attempt === attempts) {
        console.error(`[${name}] All ${attempts} connection attempts failed`);
        throw error;
      }
      console.warn(
        `[${name}] Connection attempt ${attempt}/${attempts} failed, retrying in ${delayMs}ms...`
      );
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export async function connectMongoDB(
  attempts?: number,
  delayMs?: number
): Promise<void> {
  await connectWithRetry(
    async () => {
      await mongoose.connect(env.MONGODB_URI);
    },
    "MongoDB",
    attempts,
    delayMs
  );
}

export const pgPool = new Pool({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  database: env.POSTGRES_DB,
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export async function connectPostgres(
  attempts?: number,
  delayMs?: number
): Promise<void> {
  await connectWithRetry(
    async () => {
      const client = await pgPool.connect();
      client.release();
    },
    "PostgreSQL",
    attempts,
    delayMs
  );
}

export async function connectDatabases(): Promise<void> {
  await Promise.all([connectMongoDB(), connectPostgres()]);
}
