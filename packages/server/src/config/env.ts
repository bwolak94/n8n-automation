import { cleanEnv, num, port, str } from "envalid";

export const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "test", "production"],
    default: "development",
  }),
  PORT: port({ default: 3000 }),

  // Authentication
  JWT_SECRET: str(),
  JWT_EXPIRES_IN: str({ default: "7d" }),

  // MongoDB
  MONGODB_URI: str(),

  // PostgreSQL
  POSTGRES_HOST: str({ default: "localhost" }),
  POSTGRES_PORT: port({ default: 5432 }),
  POSTGRES_DB: str(),
  POSTGRES_USER: str(),
  POSTGRES_PASSWORD: str(),

  // Redis
  REDIS_URL: str({ default: "redis://localhost:6379" }),

  // Worker
  WORKER_CONCURRENCY: num({ default: 5 }),

  // CORS
  CORS_ORIGIN: str({ default: "http://localhost:5173" }),

  // Stripe (optional — billing features)
  STRIPE_SECRET_KEY: str({ default: "" }),
  STRIPE_WEBHOOK_SECRET: str({ default: "" }),

  // Anthropic (optional — AI node)
  ANTHROPIC_API_KEY: str({ default: "" }),
});
