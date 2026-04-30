import type { NextFunction, Request, Response } from "express";
import type { AnalyticsService } from "./AnalyticsService.js";

export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  getDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.analyticsService.getDashboard(req.tenantId!);
      res.json(data);
    } catch (err) {
      next(err);
    }
  };
}
