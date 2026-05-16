import { Router } from "express";
import type { AnalyticsController } from "./AnalyticsController.js";

export function createAnalyticsRouter(controller: AnalyticsController): Router {
  const router = Router();
  router.get("/", controller.getDashboard);
  return router;
}
