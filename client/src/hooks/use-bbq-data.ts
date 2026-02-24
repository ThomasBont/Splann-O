import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { Barbecue } from "@shared/schema";

export function useBarbecues() {
  return useQuery({
    queryKey: ['/api/barbecues'],
    queryFn: async () => {
      const res = await fetch(api.barbecues.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch barbecues");
      return res.json() as Promise<Barbecue[]>;
    },
  });
}

export function usePublicBarbecues() {
  return useQuery({
    queryKey: ['/api/barbecues/public'],
    queryFn: async () => {
      const res = await fetch(api.barbecues.listPublic.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch public events");
      return res.json() as Promise<Barbecue[]>;
    },
  });
}

export function useCreateBarbecue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      date: string;
      currency: string;
      creatorId?: string;
      isPublic?: boolean;
      allowOptInExpenses?: boolean;
      area?: string;
      eventType?: string;
      templateData?: unknown;
    }) => {
      const res = await fetch(api.barbecues.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message || "Failed to create barbecue");
      }
      return res.json() as Promise<Barbecue>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues'] });
    },
  });
}

export function useUpdateBarbecue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, allowOptInExpenses, templateData, status }: { id: number; allowOptInExpenses?: boolean; templateData?: unknown; status?: "draft" | "active" | "settling" | "settled" }) => {
      const url = buildUrl(api.barbecues.update.path, { id });
      const body: Record<string, unknown> = {};
      if (allowOptInExpenses !== undefined) body.allowOptInExpenses = allowOptInExpenses;
      if (templateData !== undefined) body.templateData = templateData;
      if (status !== undefined) body.status = status;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update barbecue");
      return res.json() as Promise<Barbecue>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues'] });
    },
  });
}

export type EventNotification = {
  id: number;
  barbecueId: number;
  type: string;
  payload: { creatorName?: string; amountOwed?: number; eventName?: string; currency?: string } | null;
  createdAt: string | null;
  readAt: string | null;
};

export function useEventNotifications(enabled = true) {
  return useQuery({
    queryKey: ["/api/notifications/events"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/events", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json() as Promise<EventNotification[]>;
    },
    enabled,
  });
}

export function useMarkEventNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/notifications/events/${id}/read`, { method: "PATCH", credentials: "include" });
      if (!res.ok) throw new Error("Failed to mark read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/events"] });
    },
  });
}

export function useSettleUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/barbecues/${id}/settle-up`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to settle up");
      return res.json() as Promise<Barbecue>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues'] });
    },
  });
}

export function useEnsureInviteToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/barbecues/${id}/ensure-invite-token`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to ensure invite token");
      return (await res.json()) as Barbecue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues'] });
    },
  });
}

export function useDeleteBarbecue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.barbecues.delete.path, { id });
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete barbecue");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues'] });
    },
  });
}
