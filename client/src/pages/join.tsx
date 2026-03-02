"use client";

import { useRoute, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useJoinBarbecue } from "@/hooks/use-participants";
import { useUpgrade } from "@/contexts/UpgradeContext";
import { UpgradeRequiredError } from "@/lib/upgrade";
import { Button } from "@/components/ui/button";
import { SplannoLogo } from "@/components/splanno-logo";
import { Loader2 } from "lucide-react";

interface JoinInfo {
  bbqId: number;
  name: string;
  eventType: string;
  currency: string;
}

export default function JoinPage() {
  const [, paramsJoin] = useRoute("/join/:token");
  const [, paramsInvite] = useRoute("/invite/:token");
  const [, setLocation] = useLocation();
  const token = paramsInvite?.token ?? paramsJoin?.token;
  const { user, isLoading: isAuthLoading } = useAuth();
  const [joined, setJoined] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/invites", token],
    queryFn: async (): Promise<JoinInfo> => {
      const inviteRes = await fetch(`/api/invites/${token}`, { credentials: "include" });
      if (inviteRes.ok) {
        const body = await inviteRes.json() as { eventId: number; name: string; eventType: string; currency: string };
        return { bbqId: body.eventId, name: body.name, eventType: body.eventType, currency: body.currency };
      }
      const fallback = await fetch(`/api/join/${token}`, { credentials: "include" });
      if (!fallback.ok) throw new Error("Invite not found");
      return fallback.json();
    },
    enabled: !!token,
  });

  const joinBbq = useJoinBarbecue();
  const { showUpgrade } = useUpgrade();

  useEffect(() => {
    if (joined && data) {
      setLocation(`/app/e/${data.bbqId}`);
    }
  }, [joined, data, setLocation]);

  const handleJoin = () => {
    if (!user || !data) return;
    if (paramsInvite?.token) {
      fetch(`/api/invites/${token}/accept`, { method: "POST", credentials: "include" })
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error((body as { message?: string }).message || "Invite accept failed");
          }
          const body = await res.json().catch(() => ({})) as { eventId?: number };
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["/api/memberships"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/barbecues"] }),
            body.eventId
              ? queryClient.invalidateQueries({ queryKey: ["/api/events", body.eventId, "members"] })
              : Promise.resolve(),
            queryClient.refetchQueries({ queryKey: ["/api/barbecues"] }),
          ]);
          if (body.eventId) {
            setLocation(`/app/e/${body.eventId}`);
            return;
          }
          setJoined(true);
        })
        .catch((err: unknown) => {
          if ((err as Error).message.includes("already")) setJoined(true);
        });
      return;
    }
    joinBbq.mutate(
      { bbqId: data.bbqId, name: user.username, userId: user.username },
      {
        onSuccess: () => setJoined(true),
        onError: (err: unknown) => {
          if (err instanceof UpgradeRequiredError) {
            showUpgrade(err.payload);
            return;
          }
          if ((err as Error).message === "already_joined" || (err as Error).message === "already_pending") {
            setJoined(true);
          }
        },
      }
    );
  };

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-background">
        <SplannoLogo />
        <p className="text-muted-foreground">Invalid invite link.</p>
        <Button variant="outline" onClick={() => setLocation("/")}>
          Go home
        </Button>
      </div>
    );
  }

  if (isLoading || error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-background">
        <SplannoLogo />
        {isLoading ? (
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        ) : (
          <>
            <p className="text-muted-foreground">Invite not found or expired.</p>
            <Button variant="outline" onClick={() => setLocation("/")}>
              Go home
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-6 bg-background">
      <SplannoLogo />
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold">You&apos;re invited to</h1>
        <p className="text-2xl font-bold text-primary">{data?.name}</p>
      </div>
      {!user ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Log in to join this event.</p>
          <Button onClick={() => setLocation("/login")}>Log in</Button>
        </div>
      ) : joinBbq.isPending || joined ? (
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      ) : (
        <Button onClick={handleJoin}>Join event</Button>
      )}
    </div>
  );
}
