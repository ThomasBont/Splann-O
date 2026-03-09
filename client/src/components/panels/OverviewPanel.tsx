import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BarChart3, Camera, CheckCircle2, Crown, Link2, Loader2, Upload, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import { useAppToast } from "@/hooks/use-app-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { convertCurrency } from "@/hooks/use-language";
import { usePlan, usePlanCrew, usePlanExpenses } from "@/hooks/use-plan-data";
import { useUpdateBarbecue, useUploadEventBanner } from "@/hooks/use-bbq-data";
import { resolveAssetUrl, withCacheBust } from "@/lib/asset-url";
import { getBannerPresetClass, getBannerPresetTone, getEventBanner } from "@/lib/event-banner";
import { computeSplit } from "@/lib/split/calc";
import { circularActionButtonClass, cn } from "@/lib/utils";
import { usePanel } from "@/state/panel";
import { PanelShell, useActiveEventId } from "@/components/panels/panel-primitives";
import { buildCrewContributionRows } from "@/components/panels/crew-contribution";
import { getUpNext, getUpNextCandidates, getUpNextRotationIntervalMs } from "@/components/panels/up-next";
import { useEventGuests } from "@/hooks/use-event-guests";
import { usePlanActivity } from "@/hooks/use-plan-activity";
import { useLatestRunningPoll } from "@/hooks/use-latest-running-poll";
import { formatActivityPreview, formatActivityTime, getActivityIcon } from "@/components/panels/activity-format";

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

type HeroStatusTone = "cta-outline" | "cta-primary" | "positive" | "negative" | "settled" | "muted";
type HeroStatusAction = "invite" | "crew" | "expense" | null;
type HeroStatus = { label: string; tone: HeroStatusTone; action: HeroStatusAction };

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

function countryCodeToFlagEmoji(countryCode: string | null | undefined) {
  const code = String(countryCode ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...Array.from(code).map((char) => 127397 + char.charCodeAt(0)));
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
  const isMobile = useIsMobile();
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
    refetchInterval: eventId ? 5_000 : false,
    refetchOnWindowFocus: true,
  });

  const plan = planQuery.data;
  const participants = crewQuery.data?.participants ?? [];
  const members = crewQuery.data?.members ?? [];
  const expenses = expensesQuery.data ?? [];
  const guests = useEventGuests(eventId);
  const pendingInvites = guests.invitesPending;
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
  const localCurrency = typeof plan?.localCurrency === "string" ? plan.localCurrency.trim().toUpperCase() : "";
  const localCurrencyFlag = countryCodeToFlagEmoji(
    typeof plan?.countryCode === "string"
      ? plan.countryCode
      : (plan?.locationMeta as { countryCode?: string | null } | null | undefined)?.countryCode,
  );
  const showLocalCurrency = !!localCurrency && localCurrency !== currency;
  const totalShared = useMemo(
    () => expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    [expenses],
  );
  const localSharedTotal = useMemo(
    () => (showLocalCurrency ? convertCurrency(totalShared, currency, localCurrency) : 0),
    [currency, localCurrency, showLocalCurrency, totalShared],
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
  const activityQuery = usePlanActivity(eventId, !!eventId);
  const activityItems = activityQuery.latestItems;
  const latestRunningPollQuery = useLatestRunningPoll(eventId, !!eventId);
  const isCreator = Number(plan?.creatorUserId) === Number(user?.id);
  const [upNextRotationIndex, setUpNextRotationIndex] = useState(0);

  const hasAnyExpenses = expenses.length > 0;
  const hasOnlyCreator = participants.length <= 1;
  const allBalancesZero = balances.every((entry) => Math.abs(Number(entry.balance) || 0) < 0.01);
  const settlementCompleted = latestSettlement?.status === "settled" && allBalancesZero;
  const personalStatus = useMemo<HeroStatus>(() => {
    if (hasOnlyCreator && !hasAnyExpenses) {
      return { label: "Invite Friends", tone: "cta-outline", action: "invite" };
    }
    if (!hasOnlyCreator && !hasAnyExpenses) {
      return { label: "Add Expense", tone: "cta-primary", action: "expense" };
    }
    if (settlementCompleted) {
      return { label: "All settled", tone: "settled", action: null };
    }
    if (!myParticipant || !myBalance) return { label: "No personal split yet", tone: "muted", action: null };
    const amount = Number(myBalance.balance) || 0;
    if (Math.abs(amount) < 0.01) return { label: "All settled", tone: "settled", action: null };
    if (amount > 0) return { label: `You are owed ${formatCurrency(amount, currency)}`, tone: "positive", action: null };
    return { label: `You owe ${formatCurrency(Math.abs(amount), currency)}`, tone: "negative", action: null };
  }, [currency, hasAnyExpenses, hasOnlyCreator, myBalance, myParticipant, settlementCompleted]);

  const contributionRows = useMemo(() => {
    return buildCrewContributionRows({ participants, members, expenses }).map((row, index) => ({
      ...row,
      tint: avatarTint(index),
      isMe: row.id === myParticipant?.id,
    }));
  }, [expenses, members, myParticipant?.id, participants]);

  const topPayerId = contributionRows[0]?.id ?? null;
  const visibleContributors = contributionRows.slice(0, isMobile ? 3 : 5);
  const hiddenContributorCount = Math.max(contributionRows.length - visibleContributors.length, 0);
  const visibleActivityItems = activityItems.slice(0, isMobile ? 2 : 3);
  const latestRunningPoll = latestRunningPollQuery.latestRunningPoll?.data ?? null;
  const latestRunningPollLeadingOption = latestRunningPoll?.options.find((option) => option.isLeading) ?? null;

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
  const visibleBalanceRows = isMobile ? balanceRows.slice(0, 3) : balanceRows;
  const showSettlementCard = !isMobile || !!latestSettlement || canSettle;

  const maxAbsBalance = Math.max(
    1,
    ...balanceRows.map((entry) => Math.abs(Number(entry.balance) || 0)),
  );

  const openExpenses = () => replacePanel({ type: "expenses" });
  const openSettlement = () => replacePanel({ type: "settlement" });
  const openCrew = () => replacePanel({ type: "crew" });
  const openInvite = () => replacePanel({ type: "invite", source: "overview" });
  const openUpNext = () => replacePanel({ type: "next-action" });
  const openPlanDetails = () => replacePanel({ type: "plan-details" });
  const openRecentActivity = () => replacePanel({ type: "recent-activity" });
  const openMemberProfile = (username?: string | null, source: "overview" | "crew" = "overview") => {
    const targetUsername = username?.trim();
    if (!targetUsername) return;
    replacePanel({ type: "member-profile", username: targetUsername, source });
  };
  const openAddExpenseFlow = () => {
    if (!eventId) return;
    replacePanel({ type: "add-expense", source: "overview" });
  };
  const heroActionHandlers: Partial<Record<Exclude<HeroStatusAction, null>, () => void>> = {
    invite: openInvite,
    crew: openCrew,
    expense: openAddExpenseFlow,
  };
  const handleHeroAction = personalStatus.action ? heroActionHandlers[personalStatus.action] : undefined;
  const handleHeroActionClick = handleHeroAction
    ? (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
        handleHeroAction();
      }
    : undefined;
  const handleHeroActionKeyDown = personalStatus.action
    ? (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          handleHeroAction?.();
        }
      }
    : undefined;
  const upNextContext = {
    participantCount: participants.length,
    expensesCount: expenses.length,
    pendingInvitesCount: pendingInvites.length,
    canSettle,
    latestSettlementStatus: latestSettlement?.status ?? null,
    unpaidTransfers,
    eventDate: plan?.date,
    isCreator,
  };
  const upNextCandidates = useMemo(() => getUpNextCandidates(upNextContext), [
    upNextContext.canSettle,
    upNextContext.eventDate,
    upNextContext.expensesCount,
    upNextContext.isCreator,
    upNextContext.latestSettlementStatus,
    upNextContext.participantCount,
    upNextContext.pendingInvitesCount,
    upNextContext.unpaidTransfers,
  ]);
  const upNextItem = getUpNext(upNextContext, upNextRotationIndex);
  const upNext = {
    ...upNextItem,
    onAction: upNextItem.action === "settlement"
      ? openSettlement
      : upNextItem.action === "invite"
        ? openInvite
      : upNextItem.action === "add-expense"
        ? openAddExpenseFlow
      : upNextItem.action === "crew"
        ? openCrew
      : upNextItem.action === "expenses"
        ? openExpenses
          : upNextItem.action === "plan-details"
            ? openPlanDetails
            : null,
  };

  useEffect(() => {
    setUpNextRotationIndex(0);
  }, [upNextCandidates.length, eventId]);

  useEffect(() => {
    if (upNextCandidates.length <= 1) return;
    const interval = window.setInterval(() => {
      setUpNextRotationIndex((current) => (current + 1) % upNextCandidates.length);
    }, getUpNextRotationIntervalMs());
    return () => window.clearInterval(interval);
  }, [upNextCandidates.length]);

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
  const eventBanner = useMemo(() => getEventBanner(plan), [plan]);
  const bannerPresetClass = useMemo(
    () => getBannerPresetClass(eventBanner.presetId),
    [eventBanner.presetId],
  );
  const bannerPresetTone = useMemo(
    () => getBannerPresetTone(eventBanner.presetId) ?? "dark-content",
    [eventBanner.presetId],
  );
  const bannerVersionToken = (() => {
    const raw = (plan as { updatedAt?: string | Date | null } | null)?.updatedAt;
    if (raw instanceof Date) return raw.getTime();
    return raw ?? plan?.id ?? null;
  })();
  const planBannerUrl = withCacheBust(
    eventBanner.uploadedUrl ?? null,
    bannerVersion || bannerVersionToken,
  );
  const hasCustomBanner = !!eventBanner.uploadedUrl;
  const hasVisibleBanner = !!planBannerUrl && !bannerImageFailed;
  const hasPresetBanner = !hasVisibleBanner && !!bannerPresetClass;
  const hasHeroBanner = hasVisibleBanner || hasPresetBanner;
  const activeBannerTone = hasVisibleBanner ? bannerTone : bannerPresetTone;
  const heroPrimaryTextClass = hasHeroBanner
    ? activeBannerTone === "light-content"
      ? "text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.18)]"
      : "text-slate-950"
    : "text-foreground";
  const heroSecondaryTextClass = hasHeroBanner
    ? activeBannerTone === "light-content"
      ? "text-white/84"
      : "text-slate-900/72"
    : "text-muted-foreground";
  const heroIconButtonClass = hasHeroBanner
    ? activeBannerTone === "light-content"
      ? "border-white/20 bg-black/25 text-white/90"
      : "border-black/10 bg-white/70 text-slate-900 dark:border-white/10 dark:bg-[hsl(var(--surface-1))]/88 dark:text-[hsl(var(--text-primary))]"
    : "";
  const heroPrimaryTextStyle = hasHeroBanner
    ? {
        color: activeBannerTone === "light-content" ? "rgba(255, 255, 255, 0.98)" : "rgba(2, 6, 23, 0.96)",
        textShadow: activeBannerTone === "light-content" ? "0 1px 10px rgba(0,0,0,0.18)" : undefined,
      }
    : undefined;
  const heroSecondaryTextStyle = hasHeroBanner
    ? {
        color: activeBannerTone === "light-content" ? "rgba(255, 255, 255, 0.84)" : "rgba(15, 23, 42, 0.72)",
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
      <div className={cn("flex items-center justify-between gap-4 rounded-t-[inherit] border-b border-neutral-200 bg-neutral-50 px-6 py-4 dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-1))]", isMobile && "px-3.5 py-2.5")}>
        <p className={cn("font-semibold tracking-tight text-foreground", isMobile ? "text-lg" : "text-xl")}>Overview</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "shrink-0 rounded-md transition hover:bg-[hsl(var(--surface-2))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isMobile ? "h-8 w-8" : "h-9 w-9",
          )}
          onClick={closePanel}
          aria-label="Close panel"
        >
          <ArrowRight className="h-4 w-4 rotate-180" />
        </Button>
      </div>

      <div className={cn("flex-1 space-y-4 overflow-y-auto px-5 py-5", isMobile && "space-y-3 px-3.5 pb-20 pt-3")}>
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
            <section
              role="button"
              tabIndex={0}
              onClick={openPlanDetails}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openPlanDetails();
                }
              }}
              className={cn(
                "interactive-card relative overflow-hidden rounded-[20px] p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isMobile && "rounded-[18px] p-3.5",
                hasVisibleBanner
                  ? "border border-black/5 bg-primary/5 dark:border-[hsl(var(--border-subtle))] dark:bg-[linear-gradient(180deg,hsl(var(--surface-2))/0.98,hsl(var(--surface-1))/0.98)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  : "border border-primary/15 bg-primary/10 shadow-[var(--shadow-sm)] dark:border-[hsl(var(--border-subtle))] dark:bg-[linear-gradient(180deg,hsl(var(--surface-2)),hsl(var(--surface-1)))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
              )}
            >
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
              <div className={cn("relative z-10 space-y-4", isMobile && "space-y-2.5")}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2
                      className={cn(isMobile ? "text-lg font-semibold tracking-tight" : "text-2xl font-semibold tracking-tight", !hasVisibleBanner && heroPrimaryTextClass)}
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
                            "shrink-0 rounded-full",
                            isMobile ? "h-9 w-9" : "h-9 w-9",
                            heroIconButtonClass,
                          )}
                          onClick={(event) => {
                            event.stopPropagation();
                          }}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                          }}
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
                    className={cn(isMobile ? "text-[1.8rem] font-bold tracking-tight" : "text-4xl font-bold tracking-tight", !hasVisibleBanner && heroPrimaryTextClass)}
                    style={heroPrimaryTextStyle}
                  >
                    {formatCurrency(totalShared, currency)}
                  </p>
                  <p
                    className={cn("mt-1.5 text-sm", !hasVisibleBanner && heroSecondaryTextClass)}
                    style={heroSecondaryTextStyle}
                  >
                    {participants.length} people · {expenses.length} expense{expenses.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className={cn(
                  "inline-flex w-fit items-center rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-[transform,box-shadow,background-color,border-color] duration-150",
                  isMobile && "min-h-10 w-full justify-center px-4 py-2 text-sm",
                  personalStatus.action && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm",
                  hasVisibleBanner && "backdrop-blur-sm",
                  personalStatus.tone === "positive" && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300",
                  personalStatus.tone === "negative" && "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200",
                  personalStatus.tone === "settled" && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300",
                  personalStatus.tone === "muted" && "border-border/70 bg-background/70 text-muted-foreground dark:border-white/8 dark:bg-[hsl(var(--surface-2))]/88",
                  personalStatus.tone === "cta-outline" && "border-primary/50 bg-primary/10 text-foreground hover:border-primary/70 hover:bg-primary/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  personalStatus.tone === "cta-primary" && "border-primary/60 bg-primary text-slate-900 hover:border-primary/75 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  hasVisibleBanner && bannerTone === "dark-content" && personalStatus.tone === "muted" && "border-black/10 bg-white/72 text-slate-900/78 dark:border-white/10 dark:bg-[hsl(var(--surface-1))]/84 dark:text-[hsl(var(--text-secondary))]",
                )}
                  role={personalStatus.action ? "button" : undefined}
                  tabIndex={personalStatus.action ? 0 : undefined}
                  onClick={handleHeroActionClick}
                  onKeyDown={handleHeroActionKeyDown}
                >
                  {personalStatus.label}
                </div>
              </div>
              {showLocalCurrency ? (
                <div className={cn("pointer-events-none absolute bottom-5 right-5", isMobile && "bottom-3.5 right-3.5")}>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm",
                      hasVisibleBanner
                        ? "border-white/20 bg-white/10 text-white/82 backdrop-blur-sm"
                        : "border-border/70 bg-background/88 text-muted-foreground dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-2))]/92",
                    )}
                    style={!hasVisibleBanner ? heroSecondaryTextStyle : undefined}
                  >
                    {localCurrencyFlag ? `${localCurrencyFlag} ` : ""}{formatCurrency(localSharedTotal, localCurrency)}
                  </span>
                </div>
              ) : null}
            </section>

            <section className={cn("space-y-4", isMobile && "space-y-3")}>
            <section
              role="button"
              tabIndex={0}
              onClick={openUpNext}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openUpNext();
                }
              }}
              className={cn(
                "interactive-card rounded-[18px] border border-primary/15 bg-primary/10 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-[hsl(var(--border-subtle))] dark:bg-[linear-gradient(180deg,hsl(var(--surface-2)),hsl(var(--surface-1)))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
                isMobile && "p-3",
              )}
            >
              <div className={cn("flex items-center justify-between gap-3", isMobile && "flex-col items-start")}>
                <div>
                  <p className="text-sm font-semibold tracking-tight text-foreground">Up next</p>
                  <p className={cn("mt-1 text-sm text-foreground/90", isMobile && "pr-2 text-[13px] leading-4.5")}>{upNext.title}</p>
                </div>
                {upNext.ctaLabel && upNext.onAction ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      upNext.onAction?.();
                    }}
                    className={cn(isMobile && "h-10 w-full rounded-full px-4")}
                  >
                    {upNext.ctaLabel}
                  </Button>
                ) : (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
                    DONE
                  </span>
                )}
              </div>
              {latestRunningPoll ? (
                <div className="mt-3 rounded-2xl border border-yellow-200/80 bg-white/70 p-3 backdrop-blur-sm dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-2))]/96">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-700 dark:text-yellow-300">
                        <BarChart3 className="h-3.5 w-3.5" />
                        Live vote
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-foreground">
                        {latestRunningPoll.poll.question}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {latestRunningPoll.totalEligibleVoters
                          ? `${latestRunningPoll.totalVotes} / ${latestRunningPoll.totalEligibleVoters} people voted`
                          : `${latestRunningPoll.totalVotes} vote${latestRunningPoll.totalVotes === 1 ? "" : "s"}`}
                      </span>
                      <span>
                        {latestRunningPollLeadingOption
                          ? `Leading: ${latestRunningPollLeadingOption.label}`
                          : "No leader yet"}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {latestRunningPoll.options.slice(0, 2).map((option) => {
                        const width = latestRunningPoll.totalVotes > 0
                          ? Math.max(8, Math.round((option.voteCount / latestRunningPoll.totalVotes) * 100))
                          : 0;
                        return (
                          <div key={`overview-up-next-poll-${option.id}`} className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-xs text-foreground">
                              <span className="truncate">{option.label}</span>
                              <span className="text-muted-foreground">{option.voteCount}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-neutral-200/90 dark:bg-white/10">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  option.isLeading ? "bg-yellow-400" : "bg-neutral-400/80 dark:bg-white/20",
                                )}
                                style={{ width: `${width}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>

            <section
              role="button"
              tabIndex={0}
              onClick={openCrew}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openCrew();
                }
              }}
              className={cn(
                "interactive-card w-full rounded-[18px] border border-black/5 bg-background/96 p-4 text-left hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-1))]/96 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:hover:bg-[hsl(var(--surface-2))]",
                isMobile && "p-3",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold tracking-tight text-foreground">Crew contribution</p>
                  {!isMobile ? <p className="mt-1 text-xs text-muted-foreground">Who has been picking things up for the group</p> : null}
                </div>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className={cn("mt-5 flex items-start gap-3 overflow-x-auto pb-1 pt-1", isMobile && "mt-3 gap-2")}>
                {visibleContributors.map((person: { id: number; name: string; firstName: string; totalPaid: number; tint: string; avatarUrl?: string | null; displayName?: string; username?: string | null }) => (
                  <div key={`overview-contributor-${person.id}`} className={cn("min-w-[64px] text-center", isMobile && "min-w-[54px]")}>
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
                            isMobile ? "h-10 w-10 border border-border/70 shadow-sm" : "h-12 w-12 border border-border/70 shadow-sm",
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
                            isMobile ? "h-10 w-10 border border-border/70 shadow-sm" : "h-12 w-12 border border-border/70 shadow-sm",
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
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-dashed border-border/70 bg-background text-xs font-semibold text-muted-foreground dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-2))]/90">
                      +{hiddenContributorCount}
                    </div>
                    <p className="mt-2 text-xs font-medium text-foreground">more</p>
                  </div>
                ) : null}
              </div>
            </section>

            <section
              role="button"
              tabIndex={0}
              onClick={openExpenses}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openExpenses();
                }
              }}
              className={cn(
                "interactive-card rounded-[18px] border border-black/5 bg-background/96 p-4 hover:border-border/80 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-1))]/96 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:hover:bg-[hsl(var(--surface-2))]",
                isMobile && "p-3",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold tracking-tight text-foreground">Balances</p>
                  {!isMobile ? <p className="mt-1 text-xs text-muted-foreground">Who should receive and who still owes</p> : null}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className={cn("mt-4 space-y-3", isMobile && "mt-3 space-y-2.5")}>
                {visibleBalanceRows.length > 0 ? visibleBalanceRows.map((entry) => {
                  const amount = Number(entry.balance) || 0;
                  const width = Math.max((Math.abs(amount) / maxAbsBalance) * 50, Math.abs(amount) > 0.01 ? 8 : 0);
                  const isMine = entry.id === myBalance?.id;
                  return (
                    <div key={`overview-balance-${entry.id}`} className={cn("grid items-center gap-3", isMobile ? "grid-cols-[72px,1fr,72px]" : "grid-cols-[92px,1fr,72px]")}>
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

            {showSettlementCard ? (
            <section
              role="button"
              tabIndex={0}
              onClick={openSettlement}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openSettlement();
                }
              }}
              className={cn(
              "interactive-card rounded-[18px] border border-primary/15 bg-primary/10 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-[hsl(var(--border-subtle))] dark:bg-[linear-gradient(180deg,hsl(var(--surface-2)),hsl(var(--surface-1)))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
              isMobile && "p-3",
              latestSettlement?.status === "settled"
                ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/25 dark:bg-emerald-500/10"
                : "",
            )}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold tracking-tight text-foreground">Settle up</p>
                  {!isMobile ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {settlementTransfers.length > 0
                      ? `${paidTransfers}/${settlementTransfers.length} payments marked paid`
                      : latestSettlement?.status === "settled"
                        ? "Everything has been paid"
                        : canSettle
                          ? "Balances are ready to turn into a settlement"
                          : "Settlement will appear when shared balances need it"}
                  </p>
                  ) : null}
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
              </div>
            </section>
            ) : null}

            {!isMobile ? (
            <section
              role="button"
              tabIndex={0}
              onClick={openRecentActivity}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openRecentActivity();
                }
              }}
              className="interactive-card rounded-[18px] border border-black/5 bg-background/96 p-4 hover:border-border/80 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-1))]/96 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] dark:hover:bg-[hsl(var(--surface-2))]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold tracking-tight text-foreground">Recent activity</p>
                  <p className="mt-1 text-xs text-muted-foreground">The latest moments from the plan</p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  View all
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
              <ul className="mt-4 space-y-1.5">
                {visibleActivityItems.length > 0 ? visibleActivityItems.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-background/40 dark:hover:bg-[hsl(var(--surface-2))]/90">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[hsl(var(--surface-2))] text-sm dark:bg-[hsl(var(--surface-2))]/95">
                      {getActivityIcon(item.type)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 text-sm font-medium leading-5 text-foreground">
                          <span className="line-clamp-2">{formatActivityPreview(item, currency)}</span>
                        </p>
                        <span className="shrink-0 pt-0.5 text-[11px] text-muted-foreground">
                          {formatActivityTime(item.createdAt)}
                        </span>
                      </div>
                    </div>
                  </li>
                )) : (
                  <li className="rounded-xl bg-background/40 px-2 py-3 text-sm text-muted-foreground dark:bg-[hsl(var(--surface-2))]/90">No activity yet.</li>
                )}
              </ul>
            </section>
            ) : null}
            </section>
          </>
        ) : null}
      </div>
    </PanelShell>
  );
}

export default OverviewPanel;
