import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Camera, CheckCircle2, Crown, Link2, Loader2, Upload, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatRelativeTime } from "@/components/event/EventActivityFeed";
import { useAuth } from "@/hooks/use-auth";
import { useAppToast } from "@/hooks/use-app-toast";
import { usePlan, usePlanCrew, usePlanExpenses } from "@/hooks/use-plan-data";
import { useUpdateBarbecue, useUploadEventBanner } from "@/hooks/use-bbq-data";
import { resolveAssetUrl, withCacheBust } from "@/lib/asset-url";
import { computeSplit } from "@/lib/split/calc";
import { circularActionButtonClass, cn } from "@/lib/utils";
import { usePanel } from "@/state/panel";
import { getEventActivity } from "@/utils/eventActivity";
import { PanelShell, useActiveEventId } from "@/components/panels/panel-primitives";
import { buildCrewContributionRows } from "@/components/panels/crew-contribution";

type SettlementResponse = {
  settlement: {
    id: string;
    status: "proposed" | "in_progress" | "settled";
    currency: string | null;
  } | null;
  transfers: Array<{
    id: string;
    settlementId: string;
    fromName?: string;
    toName?: string;
    amount: number;
    paidAt: string | null;
  }>;
};

function formatCurrency(amount: number, currencyCode?: string | null) {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const code = String(currencyCode ?? "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(code)) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(safeAmount);
    } catch {
      // fall through
    }
  }
  return `€ ${safeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function avatarTint(index: number) {
  const palette = [
    "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100",
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100",
    "bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-100",
    "bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-100",
    "bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-100",
  ];
  return palette[index % palette.length];
}

function detectBannerTone(image: HTMLImageElement): "light-content" | "dark-content" {
  try {
    const sampleWidth = 36;
    const sampleHeight = 24;
    const canvas = document.createElement("canvas");
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    const context = canvas.getContext("2d");
    if (!context) return "light-content";

    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) return "light-content";

    const sourceX = Math.max(0, Math.floor(sourceWidth * 0.04));
    const sourceY = Math.max(0, Math.floor(sourceHeight * 0.35));
    const sourceSampleWidth = Math.max(1, Math.floor(sourceWidth * 0.62));
    const sourceSampleHeight = Math.max(1, Math.floor(sourceHeight * 0.58));

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSampleWidth,
      sourceSampleHeight,
      0,
      0,
      sampleWidth,
      sampleHeight,
    );

    const { data } = context.getImageData(0, 0, sampleWidth, sampleHeight);
    let weightedLuminance = 0;
    let totalWeight = 0;

    for (let y = 0; y < sampleHeight; y += 1) {
      for (let x = 0; x < sampleWidth; x += 1) {
        const index = (y * sampleWidth + x) * 4;
        const alpha = data[index + 3] / 255;
        if (alpha <= 0) continue;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const horizontalWeight = 1.1 - (x / sampleWidth) * 0.35;
        const verticalWeight = 0.9 + (y / sampleHeight) * 0.4;
        const weight = alpha * horizontalWeight * verticalWeight;
        weightedLuminance += luminance * weight;
        totalWeight += weight;
      }
    }

    if (!totalWeight) return "light-content";
    const averageLuminance = weightedLuminance / totalWeight;
    return averageLuminance > 168 ? "dark-content" : "light-content";
  } catch {
    return "light-content";
  }
}

export function OverviewPanel() {
  const eventId = useActiveEventId();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toastError, toastSuccess } = useAppToast();
  const { closePanel, replacePanel } = usePanel();
  const planQuery = usePlan(eventId);
  const crewQuery = usePlanCrew(eventId);
  const expensesQuery = usePlanExpenses(eventId);
  const latestSettlementQuery = useQuery<SettlementResponse>({
    queryKey: ["/api/events", eventId, "settlement", "latest"],
    queryFn: async () => {
      if (!eventId) return { settlement: null, transfers: [] };
      const res = await fetch(`/api/events/${eventId}/settlement/latest`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load settlement");
      return res.json() as Promise<SettlementResponse>;
    },
    enabled: !!eventId,
    staleTime: 15_000,
  });

  const plan = planQuery.data;
  const participants = crewQuery.data?.participants ?? [];
  const members = crewQuery.data?.members ?? [];
  const expenses = expensesQuery.data ?? [];
  const [bannerMenuOpen, setBannerMenuOpen] = useState(false);
  const [bannerUrlInput, setBannerUrlInput] = useState("");
  const [bannerUrlError, setBannerUrlError] = useState<string | null>(null);
  const [bannerImageFailed, setBannerImageFailed] = useState(false);
  const [bannerVersion, setBannerVersion] = useState<number>(0);
  const [bannerTone, setBannerTone] = useState<"light-content" | "dark-content">("light-content");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const updateBarbecue = useUpdateBarbecue();
  const uploadEventBanner = useUploadEventBanner(eventId);
  const splitExpenses = useMemo(
    () => expenses.map((expense) => ({ ...expense, amount: Number(expense.amount || 0) })),
    [expenses],
  );
  const currency = typeof plan?.currency === "string" ? plan.currency : "EUR";
  const totalShared = useMemo(
    () => expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    [expenses],
  );
  const { balances, settlements } = useMemo(
    () => computeSplit(participants, splitExpenses, [], false),
    [participants, splitExpenses],
  );
  const canSettle = settlements.length > 0;
  const latestSettlement = latestSettlementQuery.data?.settlement ?? null;
  const settlementTransfers = latestSettlementQuery.data?.transfers ?? [];
  const paidTransfers = settlementTransfers.filter((transfer) => !!transfer.paidAt).length;
  const unpaidTransfers = settlementTransfers.length - paidTransfers;
  const myParticipant = user?.id
    ? participants.find((participant: { userId?: number | null }) => participant.userId === user.id) ?? null
    : null;
  const myBalance = myParticipant
    ? balances.find((entry) => entry.id === myParticipant.id) ?? null
    : null;
  const activityItems = useMemo(() => {
    if (!plan) return [];
    return getEventActivity({
      event: {
        id: Number(plan.id),
        name: plan.name,
        date: plan.date ?? new Date(),
        currency: typeof plan.currency === "string" ? plan.currency : undefined,
        creatorUserId: plan.creatorUserId ?? null,
      },
      expenses: expenses.map((expense) => ({
        id: expense.id,
        item: expense.item,
        amount: expense.amount,
        participantName: expense.participantName ?? undefined,
      })),
      participants,
    });
  }, [plan, expenses, participants]);
  const isCreator = Number(plan?.creatorUserId) === Number(user?.id);

  const personalStatus = useMemo(() => {
    if (!myParticipant || !myBalance) return { label: "No personal split yet", tone: "muted" as const };
    const amount = Number(myBalance.balance) || 0;
    if (Math.abs(amount) < 0.01) return { label: "All settled", tone: "settled" as const };
    if (amount > 0) return { label: `You are owed ${formatCurrency(amount, currency)}`, tone: "positive" as const };
    return { label: `You owe ${formatCurrency(Math.abs(amount), currency)}`, tone: "negative" as const };
  }, [currency, myBalance, myParticipant]);

  const contributionRows = useMemo(() => {
    return buildCrewContributionRows({ participants, members, expenses }).map((row, index) => ({
      ...row,
      tint: avatarTint(index),
      isMe: row.id === myParticipant?.id,
    }));
  }, [expenses, members, myParticipant?.id, participants]);

  const topPayerId = contributionRows[0]?.id ?? null;
  const visibleContributors = contributionRows.slice(0, 5);
  const hiddenContributorCount = Math.max(contributionRows.length - visibleContributors.length, 0);

  const balanceRows = useMemo(() => {
    const significant = balances
      .filter((entry) => Math.abs(Number(entry.balance) || 0) >= 0.01)
      .sort((a, b) => Math.abs(Number(b.balance) || 0) - Math.abs(Number(a.balance) || 0));
    const mine = myBalance ? significant.find((entry) => entry.id === myBalance.id) : null;
    const rows = significant.slice(0, 4);
    if (mine && !rows.some((entry) => entry.id === mine.id)) {
      rows[rows.length - 1] = mine;
    }
    return rows;
  }, [balances, myBalance]);

  const maxAbsBalance = Math.max(
    1,
    ...balanceRows.map((entry) => Math.abs(Number(entry.balance) || 0)),
  );

  const startManualSettlement = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error("Event not found");
      const res = await fetch(`/api/events/${eventId}/settlement/manual`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { message?: string; code?: string }));
        const error = new Error(body.message || "Failed to start settlement") as Error & { code?: string };
        error.code = body.code;
        throw error;
      }
      return res.json() as Promise<{ latest: SettlementResponse }>;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(["/api/events", eventId, "settlement", "latest"], result.latest);
    },
    onError: (error) => {
      const err = error as Error & { code?: string };
      if (err.code === "only_creator_can_start_settlement") {
        toastError("Only the plan creator can start settlement.");
        return;
      }
      toastError(err.message || "Couldn’t start settlement.");
    },
  });

  const openExpenses = () => replacePanel({ type: "expenses" });
  const openCrew = () => replacePanel({ type: "crew" });
  const openMemberProfile = (username?: string | null, source: "overview" | "crew" = "overview") => {
    const targetUsername = username?.trim();
    if (!targetUsername) return;
    replacePanel({ type: "member-profile", username: targetUsername, source });
  };
  const handleSettlementAction = () => {
    if (latestSettlement) {
      replacePanel({ type: "expenses" });
      return;
    }
    if (!isCreator || !canSettle) return;
    startManualSettlement.mutate();
  };

  const nextAction = useMemo(() => {
    if (expenses.length === 0) {
      return {
        title: "Add the first expense to get started",
        actionLabel: "Add expense",
        onAction: openExpenses,
        tone: "warm" as const,
      };
    }
    if (latestSettlement?.status === "settled") {
      return {
        title: "All done! Great trip 🎉",
        actionLabel: null,
        onAction: null,
        tone: "done" as const,
      };
    }
    if (latestSettlement) {
      return {
        title: `${unpaidTransfers} payment${unpaidTransfers === 1 ? "" : "s"} still outstanding`,
        actionLabel: "View settlement",
        onAction: handleSettlementAction,
        tone: "warm" as const,
      };
    }
    if (canSettle) {
      return {
        title: "Ready to settle up?",
        actionLabel: isCreator ? "Start settlement" : "View balances",
        onAction: isCreator ? handleSettlementAction : openExpenses,
        tone: "warm" as const,
      };
    }
    return {
      title: "Keep the trip moving",
      actionLabel: "Open money",
      onAction: openExpenses,
      tone: "warm" as const,
    };
  }, [canSettle, expenses.length, handleSettlementAction, isCreator, latestSettlement, openExpenses, unpaidTransfers]);

  const settlementStatusLabel = latestSettlement?.status === "settled"
    ? "SETTLED"
    : latestSettlement
      ? "IN PROGRESS"
      : canSettle
        ? "READY"
        : "WAITING";
  const settlementProgress = settlementTransfers.length > 0
    ? Math.round((paidTransfers / settlementTransfers.length) * 100)
    : latestSettlement?.status === "settled"
      ? 100
      : 0;
  const bannerVersionToken = (() => {
    const raw = (plan as { updatedAt?: string | Date | null } | null)?.updatedAt;
    if (raw instanceof Date) return raw.getTime();
    return raw ?? plan?.id ?? null;
  })();
  const planBannerUrl = withCacheBust(
    plan?.bannerImageUrl ?? null,
    bannerVersion || bannerVersionToken,
  );
  const hasVisibleBanner = !!planBannerUrl && !bannerImageFailed;
  const heroPrimaryTextClass = hasVisibleBanner
    ? bannerTone === "light-content"
      ? "text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.18)]"
      : "text-slate-950"
    : "text-foreground";
  const heroSecondaryTextClass = hasVisibleBanner
    ? bannerTone === "light-content"
      ? "text-white/84"
      : "text-slate-900/72"
    : "text-muted-foreground";
  const heroIconButtonClass = hasVisibleBanner
    ? bannerTone === "light-content"
      ? "border-white/20 bg-black/25 text-white/90 hover:bg-black/35 hover:text-white"
      : "border-black/10 bg-white/70 text-slate-900 hover:bg-white/85 hover:text-slate-950"
    : circularActionButtonClass();
  const heroPrimaryTextStyle = hasVisibleBanner
    ? {
        color: bannerTone === "light-content" ? "rgba(255, 255, 255, 0.98)" : "rgba(2, 6, 23, 0.96)",
        textShadow: bannerTone === "light-content" ? "0 1px 10px rgba(0,0,0,0.18)" : undefined,
      }
    : undefined;
  const heroSecondaryTextStyle = hasVisibleBanner
    ? {
        color: bannerTone === "light-content" ? "rgba(255, 255, 255, 0.84)" : "rgba(15, 23, 42, 0.72)",
      }
    : undefined;

  useEffect(() => {
    setBannerTone("light-content");
  }, [planBannerUrl]);

  const syncBannerLocally = (nextBannerUrl: string | null) => {
    if (!eventId) return;
    queryClient.setQueryData(["plan", eventId], (current: typeof plan | undefined) => (
      current ? { ...current, bannerImageUrl: nextBannerUrl } : current
    ));
    queryClient.setQueryData(["/api/barbecues"], (current: Array<Record<string, unknown>> | undefined) => (
      Array.isArray(current)
        ? current.map((entry) => (Number(entry.id) === eventId ? { ...entry, bannerImageUrl: nextBannerUrl } : entry))
        : current
    ));
    setBannerImageFailed(false);
    setBannerVersion(Date.now());
  };

  const handleBannerFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file || !eventId) return;
    const allowedTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
    if (!allowedTypes.has(file.type)) {
      toastError("Please upload JPG, PNG, or WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toastError("Image must be 5MB or smaller.");
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("Couldn’t read image file."));
        reader.readAsDataURL(file);
      });
      const uploaded = await uploadEventBanner.mutateAsync(dataUrl);
      syncBannerLocally(uploaded.bannerImageUrl ?? null);
      setBannerMenuOpen(false);
      setBannerUrlInput("");
      setBannerUrlError(null);
      toastSuccess("Banner updated");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Banner upload failed.");
    }
  };

  const handleApplyBannerUrl = async () => {
    if (!eventId) return;
    const raw = bannerUrlInput.trim();
    if (!raw) {
      setBannerUrlError("Enter an image URL.");
      return;
    }
    if (!/^https?:\/\//i.test(raw)) {
      setBannerUrlError("Use a URL starting with http:// or https://");
      return;
    }
    try {
      const updated = await updateBarbecue.mutateAsync({ id: eventId, bannerImageUrl: raw });
      syncBannerLocally(updated.bannerImageUrl ?? raw);
      setBannerMenuOpen(false);
      setBannerUrlInput("");
      setBannerUrlError(null);
      toastSuccess("Banner updated");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn’t update banner.";
      setBannerUrlError(message);
      toastError(message);
    }
  };

  return (
    <PanelShell>
      <div className="flex items-center justify-between gap-4 border-b border-[hsl(var(--border-subtle))] px-5 py-4">
        <p className="text-sm font-medium tracking-tight text-foreground">Overview</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-md transition hover:bg-[hsl(var(--surface-2))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={closePanel}
          aria-label="Close panel"
        >
          <ArrowRight className="h-4 w-4 rotate-180" />
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {!eventId ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
            Open a plan chat to see its overview.
          </div>
        ) : null}

        {eventId && !plan ? (
          <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
            Loading plan overview...
          </div>
        ) : null}

        {plan ? (
          <>
            <section className="relative overflow-hidden rounded-[20px] border border-black/5 bg-primary/5 p-6 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(250,204,21,0.12),rgba(255,255,255,0.03))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              {hasVisibleBanner ? (
                <>
                  <img
                    src={planBannerUrl}
                    alt={plan.name}
                    className="absolute inset-0 h-full w-full object-cover"
                    crossOrigin="anonymous"
                    onLoad={(event) => {
                      setBannerImageFailed(false);
                      setBannerTone(detectBannerTone(event.currentTarget));
                    }}
                    onError={() => setBannerImageFailed(true)}
                  />
                  <div
                    className={cn(
                      "absolute inset-0",
                      bannerTone === "light-content"
                        ? "bg-gradient-to-t from-black/48 via-black/16 to-transparent"
                        : "bg-gradient-to-t from-white/74 via-white/20 to-transparent",
                    )}
                  />
                </>
              ) : null}
              <div className="relative z-10 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p
                      className={cn("text-sm font-medium", !hasVisibleBanner && heroSecondaryTextClass)}
                      style={heroSecondaryTextStyle}
                    >
                      Plan total
                    </p>
                    <h2
                      className={cn("mt-1 text-2xl font-semibold tracking-tight", !hasVisibleBanner && heroPrimaryTextClass)}
                      style={heroPrimaryTextStyle}
                    >
                      {plan.name}
                    </h2>
                  </div>
                  {isCreator ? (
                    <Popover open={bannerMenuOpen} onOpenChange={setBannerMenuOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-9 w-9 shrink-0",
                            heroIconButtonClass,
                          )}
                          aria-label="Change plan banner"
                        >
                          <Camera className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-72 space-y-3 p-3">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          className="sr-only"
                          onChange={handleBannerFileChange}
                        />
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">Change banner</p>
                          <p className="text-xs text-muted-foreground">Upload an image or paste a URL.</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadEventBanner.isPending}
                        >
                          {uploadEventBanner.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                          Upload image
                        </Button>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Link2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground">Use image URL</span>
                          </div>
                          <Input
                            value={bannerUrlInput}
                            onChange={(event) => {
                              setBannerUrlInput(event.target.value);
                              if (bannerUrlError) setBannerUrlError(null);
                            }}
                            placeholder="https://example.com/banner.jpg"
                          />
                          {bannerUrlError ? <p className="text-xs text-destructive">{bannerUrlError}</p> : null}
                          <Button
                            type="button"
                            size="sm"
                            className="w-full"
                            onClick={handleApplyBannerUrl}
                            disabled={updateBarbecue.isPending}
                          >
                            {updateBarbecue.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Use image URL
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : null}
                </div>
                <div>
                  <p
                    className={cn("text-4xl font-bold tracking-tight", !hasVisibleBanner && heroPrimaryTextClass)}
                    style={heroPrimaryTextStyle}
                  >
                    {formatCurrency(totalShared, currency)}
                  </p>
                  <p
                    className={cn("mt-2 text-sm", !hasVisibleBanner && heroSecondaryTextClass)}
                    style={heroSecondaryTextStyle}
                  >
                    {participants.length} people · {expenses.length} expense{expenses.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className={cn(
                  "inline-flex w-fit items-center rounded-full border px-4 py-2 text-sm font-medium shadow-sm",
                  hasVisibleBanner && "backdrop-blur-sm",
                  personalStatus.tone === "positive" && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300",
                  personalStatus.tone === "negative" && "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200",
                  personalStatus.tone === "settled" && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300",
                  personalStatus.tone === "muted" && "border-border/70 bg-background/70 text-muted-foreground dark:border-white/8 dark:bg-[hsl(var(--surface-2))]/88",
                  hasVisibleBanner && bannerTone === "dark-content" && personalStatus.tone === "muted" && "border-black/10 bg-white/72 text-slate-900/78",
                )}>
                  {personalStatus.label}
                </div>
              </div>
            </section>

            <div
              role="button"
              tabIndex={0}
              onClick={openCrew}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openCrew();
                }
              }}
              className="w-full rounded-[18px] border border-black/5 bg-[hsl(var(--surface-1))]/78 p-4 text-left transition hover:bg-[hsl(var(--surface-1))]/88 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/9 dark:bg-[hsl(var(--surface-2))]/88 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:hover:bg-[hsl(var(--surface-2))]/96"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold tracking-tight text-foreground">Crew contribution</p>
                  <p className="mt-1 text-xs text-muted-foreground">Who has been picking things up for the group</p>
                </div>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-5 flex items-start gap-3 overflow-x-auto pb-1 pt-1">
                {visibleContributors.map((person: { id: number; name: string; firstName: string; totalPaid: number; tint: string; avatarUrl?: string | null; displayName?: string; username?: string | null }) => (
                  <div key={`overview-contributor-${person.id}`} className="min-w-[64px] text-center">
                    <div className="relative mx-auto w-fit">
                      {person.username ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openMemberProfile(person.username, "overview");
                          }}
                          className="block cursor-pointer rounded-full transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[hsl(var(--surface-2))]"
                          aria-label={`Open ${person.displayName || person.name}'s profile`}
                        >
                          <Avatar className={cn(
                            "h-12 w-12 border border-border/70 shadow-sm",
                            person.id === topPayerId && "ring-2 ring-primary/70 ring-offset-2 ring-offset-background dark:ring-offset-[hsl(var(--surface-2))]",
                            "hover:ring-2 hover:ring-primary/35",
                          )}>
                            {person.avatarUrl ? <AvatarImage src={resolveAssetUrl(person.avatarUrl) ?? person.avatarUrl} alt={person.displayName || person.name} /> : null}
                            <AvatarFallback className={cn("text-sm font-semibold", person.tint)}>
                              {getInitials(person.name)}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                      ) : (
                        <Avatar className={cn(
                          "h-12 w-12 border border-border/70 shadow-sm",
                          person.id === topPayerId && "ring-2 ring-primary/70 ring-offset-2 ring-offset-background dark:ring-offset-[hsl(var(--surface-2))]",
                        )}>
                          {person.avatarUrl ? <AvatarImage src={resolveAssetUrl(person.avatarUrl) ?? person.avatarUrl} alt={person.displayName || person.name} /> : null}
                          <AvatarFallback className={cn("text-sm font-semibold", person.tint)}>
                            {getInitials(person.name)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      {person.id === topPayerId ? (
                        <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-slate-900 shadow-sm">
                          <Crown className="h-3 w-3" />
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 truncate text-xs font-medium text-foreground">{person.firstName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatCurrency(person.totalPaid, currency)}</p>
                  </div>
                ))}
                {hiddenContributorCount > 0 ? (
                  <div className="min-w-[64px] text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-dashed border-border/70 bg-background text-xs font-semibold text-muted-foreground dark:border-white/8 dark:bg-[hsl(var(--surface-1))]/90">
                      +{hiddenContributorCount}
                    </div>
                    <p className="mt-2 text-xs font-medium text-foreground">more</p>
                  </div>
                ) : null}
              </div>
            </div>

            <section className="rounded-[18px] border border-primary/15 bg-primary/10 p-4 dark:border-primary/25 dark:bg-primary/12 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold tracking-tight text-foreground">Next action</p>
                  <p className="mt-1 text-sm text-foreground/90">{nextAction.title}</p>
                </div>
                {nextAction.actionLabel && nextAction.onAction ? (
                  <Button type="button" size="sm" onClick={nextAction.onAction}>
                    {nextAction.actionLabel}
                  </Button>
                ) : (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
                    DONE
                  </span>
                )}
              </div>
            </section>

            <section className="rounded-[18px] border border-black/5 bg-[hsl(var(--surface-1))]/78 p-4 dark:border-white/9 dark:bg-[hsl(var(--surface-2))]/88 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold tracking-tight text-foreground">Balances</p>
                  <p className="mt-1 text-xs text-muted-foreground">Who should receive and who still owes</p>
                </div>
                <Button type="button" variant="ghost" className="h-auto px-0 text-sm text-muted-foreground hover:text-foreground" onClick={openExpenses}>
                  Open money
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {balanceRows.length > 0 ? balanceRows.map((entry) => {
                  const amount = Number(entry.balance) || 0;
                  const width = Math.max((Math.abs(amount) / maxAbsBalance) * 50, Math.abs(amount) > 0.01 ? 8 : 0);
                  const isMine = entry.id === myBalance?.id;
                  return (
                    <div key={`overview-balance-${entry.id}`} className="grid grid-cols-[92px,1fr,72px] items-center gap-3">
                      <span className={cn("truncate text-xs font-medium", isMine ? "text-foreground" : "text-muted-foreground")}>
                        {entry.name.trim().split(/\s+/)[0] || entry.name}
                      </span>
                      <div className="relative h-5">
                        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border/80" />
                        {amount < 0 ? (
                          <div
                            className={cn(
                              "absolute right-1/2 top-1/2 h-2.5 -translate-y-1/2 rounded-full",
                              isMine ? "bg-amber-500" : "bg-amber-400/90",
                            )}
                            style={{ width: `${width}%` }}
                          />
                        ) : null}
                        {amount > 0 ? (
                          <div
                            className={cn(
                              "absolute left-1/2 top-1/2 h-2.5 -translate-y-1/2 rounded-full",
                              isMine ? "bg-emerald-500" : "bg-emerald-400/90",
                            )}
                            style={{ width: `${width}%` }}
                          />
                        ) : null}
                      </div>
                      <span className={cn(
                        "text-right text-xs font-semibold",
                        amount > 0 ? "text-emerald-700 dark:text-emerald-300" : amount < 0 ? "text-amber-700 dark:text-amber-200" : "text-muted-foreground",
                      )}>
                        {amount === 0 ? "€ 0,00" : formatCurrency(Math.abs(amount), currency)}
                      </span>
                    </div>
                  );
                }) : (
                  <p className="text-sm text-muted-foreground">Everyone is level right now.</p>
                )}
              </div>
            </section>

            <section className={cn(
              "rounded-[18px] border p-4",
              latestSettlement?.status === "settled"
                ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/25 dark:bg-emerald-500/10"
                : "border-black/5 bg-[hsl(var(--surface-1))]/78 dark:border-white/9 dark:bg-[hsl(var(--surface-2))]/90 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
            )}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold tracking-tight text-foreground">Settle up</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {settlementTransfers.length > 0
                      ? `${paidTransfers}/${settlementTransfers.length} payments marked paid`
                      : latestSettlement?.status === "settled"
                        ? "Everything has been paid"
                        : canSettle
                          ? "Balances are ready to turn into a settlement"
                          : "Settlement will appear when shared balances need it"}
                  </p>
                </div>
                <span className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide",
                  latestSettlement?.status === "settled"
                    ? "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "border-primary/30 bg-primary/10 text-foreground",
                )}>
                  {settlementStatusLabel}
                </span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted/70 dark:bg-white/8">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    latestSettlement?.status === "settled" ? "bg-emerald-500" : "bg-primary",
                  )}
                  style={{ width: `${settlementProgress}%` }}
                />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                {latestSettlement?.status === "settled" ? (
                  <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    All settled 🎉
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {latestSettlement
                      ? "Payments are underway. Keep the group posted as people settle up."
                      : canSettle
                        ? "The plan looks ready to settle."
                        : "Nothing to settle yet."}
                  </p>
                )}
                {latestSettlement?.status !== "settled" ? (
                  <Button type="button" onClick={handleSettlementAction} disabled={!latestSettlement && (!isCreator || !canSettle || startManualSettlement.isPending)}>
                    {startManualSettlement.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {latestSettlement ? "View settlement" : "Start settlement"}
                  </Button>
                ) : null}
              </div>
            </section>

            <section className="rounded-[18px] border border-black/5 bg-[hsl(var(--surface-1))]/76 px-4 py-2 dark:border-white/8 dark:bg-[hsl(var(--surface-2))]/84 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <ul className="divide-y divide-border/50">
                {activityItems.slice(0, 3).length > 0 ? activityItems.slice(0, 3).map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[hsl(var(--surface-2))] text-sm dark:bg-[hsl(var(--surface-1))]/95">
                      {item.icon ?? "•"}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {item.message}
                      <span className="ml-2 text-xs text-muted-foreground">{formatRelativeTime(item.timestamp)}</span>
                    </p>
                  </li>
                )) : (
                  <li className="py-3 text-sm text-muted-foreground">No activity yet.</li>
                )}
              </ul>
            </section>
          </>
        ) : null}
      </div>
    </PanelShell>
  );
}

export default OverviewPanel;
