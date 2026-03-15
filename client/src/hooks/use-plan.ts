import { useQuery } from "@tanstack/react-query";
import { apiRequestOrNull } from "@/lib/api";

export interface PlanInfo {
  plan: "free" | "pro";
  planExpiresAt: string | null;
  limits: { maxEvents: number; maxParticipantsPerEvent: number };
  features: { exportImages: boolean; watermarkExports: boolean };
}

/** Fetch plan info for authenticated user. */
export function usePlan(enabled = true) {
  return useQuery<PlanInfo | null>({
    queryKey: ["/api/me/plan"],
    queryFn: async () => {
      return apiRequestOrNull<PlanInfo>("/api/me/plan");
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}
