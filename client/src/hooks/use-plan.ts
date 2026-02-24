import { useQuery } from "@tanstack/react-query";

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
      const res = await fetch("/api/me/plan", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}
