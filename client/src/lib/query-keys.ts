export const queryKeys = {
  plans: {
    list: () => ["plans", "list"] as const,
    detail: (planId: number | null) => ["plans", "detail", planId] as const,
    messages: (planId: number | null) => ["plans", "detail", planId, "messages"] as const,
    expenses: (planId: number | null) => ["plans", "detail", planId, "expenses"] as const,
    expenseShares: (planId: number | null) => ["plans", "detail", planId, "expense-shares"] as const,
    crew: (planId: number | null) => ["plans", "detail", planId, "crew"] as const,
    activity: (planId: number | null) => ["plans", "detail", planId, "activity"] as const,
    photos: (planId: number | null) => ["plans", "detail", planId, "photos"] as const,
    balances: (planId: number | null) => ["plans", "detail", planId, "balances"] as const,
    settlements: (planId: number | null) => ["plans", "detail", planId, "settlements"] as const,
    settlementDetail: (planId: number | null, settlementId: string | null) =>
      ["plans", "detail", planId, "settlements", "detail", settlementId ?? "none"] as const,
    settlementLatest: (planId: number | null) =>
      ["plans", "detail", planId, "settlements", "latest"] as const,
    members: (planId: number | null) => ["plans", "detail", planId, "members"] as const,
    invitesPending: (planId: number | null) => ["plans", "detail", planId, "invites", "pending"] as const,
  },
} as const;

