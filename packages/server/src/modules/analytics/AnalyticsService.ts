import type { AnalyticsRepository, RecentExecution } from "./AnalyticsRepository.js";
import type { WorkflowRepository } from "../workflows/WorkflowRepository.js";

export interface AnalyticsResponse {
  totalWorkflows: number;
  executionsThisMonth: number;
  successRate: number;
  aiTokensUsed: number;
  aiTokenLimit: number;
  recentExecutions: RecentExecution[];
  volumeByDay: { date: string; success: number; failed: number }[];
  nodeTypeUsage: { type: string; count: number }[];
}

const AI_TOKEN_LIMIT = 100_000; // default free-tier limit

export class AnalyticsService {
  constructor(
    private readonly analyticsRepo: AnalyticsRepository,
    private readonly workflowRepo: WorkflowRepository
  ) {}

  async getDashboard(tenantId: string): Promise<AnalyticsResponse> {
    const [stats, recentExecutions, workflows] = await Promise.all([
      this.analyticsRepo.getStats(tenantId),
      this.analyticsRepo.getRecentExecutions(tenantId, 10),
      this.workflowRepo.findAll(tenantId, { limit: 1, offset: 0 }),
    ]);

    const total = stats.successCount + stats.failedCount;
    const successRate = total === 0 ? 0 : (stats.successCount / total) * 100;

    return {
      totalWorkflows: workflows.total,
      executionsThisMonth: stats.executionsThisMonth,
      successRate: Math.round(successRate * 10) / 10,
      aiTokensUsed: stats.aiTokensUsed,
      aiTokenLimit: AI_TOKEN_LIMIT,
      recentExecutions,
      volumeByDay: stats.volumeByDay,
      nodeTypeUsage: stats.nodeTypeUsage,
    };
  }
}
