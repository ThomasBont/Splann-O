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
import { ArrowRight, Loader2 } from "lucide-react";

interface JoinInfo {
  bbqId: number;
  name: string;
  eventType: string;
  currency: string;
  inviterName?: string | null;
}

export default function JoinPage() {
  const [, paramsJoin] = useRoute("/join/:token");
  const [, paramsInvite] = useRoute("/invite/:token");
  const [, setLocation] = useLocation();
  const token = paramsInvite?.token ?? paramsJoin?.token;
  const { user, isLoading: isAuthLoading } = useAuth();
  const [joined, setJoined] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [joinTriggered, setJoinTriggered] = useState(false);
  const queryClient = useQueryClient();
  const invitePath = paramsInvite?.token ? `/invite/${token}` : `/join/${token}`;
  const loginHref = `/login?redirect=${encodeURIComponent(invitePath)}`;

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/invites", token],
    queryFn: async (): Promise<JoinInfo> => {
      const inviteRes = await fetch(`/api/invites/${token}`, { credentials: "include" });
      if (inviteRes.ok) {
        const body = await inviteRes.json() as {
          eventId?: number;
          id?: number;
          name: string;
          eventType: string;
          currency: string;
          inviterName?: string | null;
        };
        return {
          bbqId: Number(body.eventId ?? body.id),
          name: body.name,
          eventType: body.eventType,
          currency: body.currency,
          inviterName: body.inviterName ?? null,
        };
      }
      const fallback = await fetch(`/api/join/${token}`, { credentials: "include" });
      if (!fallback.ok) throw new Error("Invite not found");
      const body = await fallback.json() as {
        id: number;
        name: string;
        eventType: string;
        currency: string;
        inviterName?: string | null;
      };
      return {
        bbqId: Number(body.id),
        name: body.name,
        eventType: body.eventType,
        currency: body.currency,
        inviterName: body.inviterName ?? null,
      };
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
    if (joinTriggered) return;
    setJoinTriggered(true);
    if (paramsInvite?.token) {
      fetch(`/api/invites/${token}/accept`, { method: "POST", credentials: "include" })
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error((body as { message?: string }).message || "Invite accept failed");
          }
          const body = await res.json().catch(() => ({})) as { eventId?: number; alreadyMember?: boolean };
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["/api/memberships"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/barbecues"] }),
            body.eventId
              ? queryClient.invalidateQueries({ queryKey: ["/api/events", body.eventId, "members"] })
              : Promise.resolve(),
            queryClient.refetchQueries({ queryKey: ["/api/barbecues"] }),
          ]);
          if (body.alreadyMember) {
            setAlreadyMember(true);
            setJoinTriggered(false);
            return;
          }
          if (body.eventId) {
            setLocation(`/app/e/${body.eventId}`);
            return;
          }
          setJoined(true);
        })
        .catch((err: unknown) => {
          setJoinTriggered(false);
          if ((err as Error).message.includes("already")) {
            setAlreadyMember(true);
          }
        });
      return;
    }
    joinBbq.mutate(
      { bbqId: data.bbqId, name: user.username, userId: Number(user.id) },
      {
        onSuccess: () => setJoined(true),
        onError: (err: unknown) => {
          setJoinTriggered(false);
          if (err instanceof UpgradeRequiredError) {
            showUpgrade(err.payload);
            return;
          }
          if ((err as Error).message === "already_joined" || (err as Error).message === "already_pending") {
            setAlreadyMember(true);
          }
        },
      }
    );
  };

  useEffect(() => {
    if (!user || !data || joined || alreadyMember || joinTriggered || joinBbq.isPending) return;
    handleJoin();
  }, [alreadyMember, data, joinBbq.isPending, joinTriggered, joined, user]);

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
      <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card px-6 py-7 shadow-sm">
        <div className="text-center space-y-3">
          <p className="text-sm font-medium text-muted-foreground">You&apos;re invited to join a plan</p>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{data?.name}</h1>
            <p className="text-sm text-muted-foreground">
              {data?.inviterName ? `${data.inviterName} invited you to join this plan.` : "Open the invite and join the plan in one step."}
            </p>
          </div>
        </div>
        {!user ? (
          <div className="mt-6 space-y-3">
            <Button className="w-full" onClick={() => setLocation(loginHref)}>
              Log in or sign up to join
              <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Create an account or log in once, then we&apos;ll take you straight into the plan.
            </p>
          </div>
        ) : alreadyMember ? (
          <div className="mt-6 space-y-3">
            <div className="rounded-2xl border border-border/60 bg-muted/35 px-4 py-3 text-center">
              <p className="text-sm font-medium text-foreground">You are already in this plan.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Open it directly and continue in the chat.
              </p>
            </div>
            <Button className="w-full" onClick={() => data && setLocation(`/app/e/${data.bbqId}`)}>
              Open plan
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : joinBbq.isPending || joined || joinTriggered || isAuthLoading ? (
          <div className="mt-6 flex flex-col items-center gap-3 py-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Joining plan...</p>
          </div>
        ) : (
          <div className="mt-6">
            <Button className="w-full" onClick={handleJoin}>Join plan</Button>
          </div>
        )}
      </div>
    </div>
  );
}
