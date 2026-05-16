import { useQuery } from "@tanstack/vue-query";
import { fetchAnalytics } from "../api/analytics.js";

export const ANALYTICS_KEY = "analytics";

export function useAnalyticsQuery() {
  return useQuery({
    queryKey: [ANALYTICS_KEY],
    queryFn: fetchAnalytics,
    staleTime: 60_000,
  });
}
