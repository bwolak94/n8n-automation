import { apiClient } from "./client.js";
import type { AnalyticsData } from "../types/index.js";

export async function fetchAnalytics(): Promise<AnalyticsData> {
  return apiClient.get("analytics").json<AnalyticsData>();
}
