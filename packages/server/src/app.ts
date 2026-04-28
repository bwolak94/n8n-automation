import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import { pgPool } from "./config/database.js";
import { env } from "./config/env.js";
import { errorHandler } from "./shared/middleware/errorHandler.js";
import { authenticate } from "./shared/middleware/authenticate.js";
import { tenantContext } from "./shared/middleware/tenantContext.js";

export function createApp(): Express {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));

  // Parse JSON bodies
  app.use(express.json());

  // Health check — public, before auth middleware
  app.get("/health", async (_req, res) => {
    const mongoStatus =
      mongoose.connection.readyState === 1 ? "ok" : "degraded";

    let pgStatus: "ok" | "degraded" = "degraded";
    try {
      const client = await pgPool.connect();
      await client.query("SELECT 1");
      client.release();
      pgStatus = "ok";
    } catch {
      // pgStatus stays 'degraded'
    }

    res.status(200).json({
      status: "ok",
      databases: { mongo: mongoStatus, postgres: pgStatus },
    });
  });

  // Authentication — all routes below require a valid JWT
  app.use(authenticate);

  // Tenant context — must run after authenticate; attaches tenantId + tenantRole
  app.use(tenantContext);

  // Feature routes are mounted here in subsequent tasks
  // app.use('/api/workflows', workflowRouter);

  // Global error handler — must be last
  app.use(errorHandler);

  return app;
}
