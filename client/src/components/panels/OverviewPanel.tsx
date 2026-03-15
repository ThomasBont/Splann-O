import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Camera, CheckCircle2, Crown, Link2, Loader2, Upload, Users } from "lucide-react";
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
import { apiRequest } from "@/lib/api";
import { resolveAssetUrl, withCacheBust } from "@/lib/asset-url";
import { formatFullDate } from "@/lib/dates";
import { getBannerPresetClass, getBannerPresetTone, getEventBanner } from "@/lib/event-banner";
import { computeSplit } from "@/lib/split/calc";
import { queryKeys } from "@/lib/query-keys";
import { circularActionButtonClass, cn } from "@/lib/utils";
import { usePanel } from "@/state/panel";
import { PanelShell, useActiveEventId } from "@/components/panels/panel-primitives";
import { buildCrewContributionRows } from "@/components/panels/crew-contribution";
import { getUpNextCandidates } from "@/components/panels/up-next";
import { useEventGuests } from "@/hooks/use-event-guests";
import { usePlanActivity } from "@/hooks/use-plan-activity";
import { formatActivityPreview, formatActivityTime, getActivityIcon } from "@/components/panels/activity-format";
import { getClientPlanStatus, getPlanFinalState, getPlanWrapUpEndsAt } from "@/lib/plan-lifecycle";

type SettlementRoundSummary = {
  id: string;
  title: string;
  roundType: "balance_settlement" | "direct_split";
  scopeType: "everyone" | "selected";
  selectedParticipantIds: number[] | null;
  status: "active" | "completed" | "cancelled";
  currency: string | null;
  paidByUserId?: number | null;
  paidByName?: string | null;
  createdAt: string | null;
  completedAt: string | null;
  transferCount: number;
  paidTransfersCount: number;
  totalAmount: number;
  outstandingAmount: number;
};

type SettlementRoundsResponse = {
  activeFinalSettlementRound: SettlementRoundSummary | null;
  activeQuickSettleRound: SettlementRoundSummary | null;
  pastFinalSettlementRounds: SettlementRoundSummary[];
  pastQuickSettleRounds: SettlementRoundSummary[];
};

type SettlementDetailResponse = {
  settlement: {
    id: string;
    title: string;
    roundType: "balance_settlement" | "direct_split";
    status: "active" | "completed" | "cancelled";
    currency: string | null;
    createdAt: string | null;
    completedAt: string | null;
  } | null;
  transfers: Array<{
    id: string;
    settlementId: string;
    settlementRoundId: string;
    fromUserId: number;
    fromName?: string;
    toUserId: number;
    toName?: string;
    amount: number;
    currency: string;
    paidAt: string | null;
    paidByUserId: number | null;
  }>;
  summary: {
    transferCount: number;
    paidTransfersCount: number;
    totalAmount: number;
    outstandingAmount: number;
  };
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
  const settlementRoundsQuery = useQuery<SettlementRoundsResponse>({
    queryKey: queryKeys.plans.settlements(eventId),
    queryFn: async () => {
      if (!eventId) {
        return {
          activeFinalSettlementRound: null,
          activeQuickSettleRound: null,
          pastFinalSettlementRounds: [],
          pastQuickSettleRounds: [],
        };
      }
      return apiRequest<SettlementRoundsResponse>(`/api/events/${eventId}/settlements`);
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
  const laterSettleExpenses = useMemo(
    () => expenses.filter((expense) => {
      const resolutionMode = String((expense as { resolutionMode?: string | null }).resolutionMode ?? "later").trim().toLowerCase();
      const excluded = Boolean((expense as { excludedFromFinalSettlement?: boolean | null }).excludedFromFinalSettlement);
      return !excluded && resolutionMode !== "now";
    }),
    [expenses],
  );
  const splitExpenses = useMemo(
    () => laterSettleExpenses.map((expense) => ({ ...expense, amount: Number(expense.amount || 0) })),
    [laterSettleExpenses],
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
    () => laterSettleExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    [laterSettleExpenses],
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
  const activeFinalSettlementRound = settlementRoundsQuery.data?.activeFinalSettlementRound ?? null;
  const pastFinalSettlementRounds = settlementRoundsQuery.data?.pastFinalSettlementRounds ?? [];
  const latestPastFinalSettlementRound = pastFinalSettlementRounds[0] ?? null;
  const planStatus = getClientPlanStatus(plan?.status);
  const isPlanClosed = planStatus === "closed";
  const isPlanSettled = planStatus === "settled";
  const isPlanArchived = planStatus === "archived";
  const isFinanciallyCompleted = isPlanSettled || isPlanArchived;
  const invitesLocked = isPlanClosed || isFinanciallyCompleted || !!activeFinalSettlementRound;
  const expensesLocked = invitesLocked;
  const completedSettlementId = isFinanciallyCompleted ? latestPastFinalSettlementRound?.id ?? null : null;
  const completedSettlementDetailQuery = useQuery<SettlementDetailResponse>({
    queryKey: queryKeys.plans.settlementDetail(eventId, completedSettlementId),
    queryFn: async () => {
      if (!eventId || !completedSettlementId) {
        return {
          settlement: null,
          transfers: [],
          summary: { transferCount: 0, paidTransfersCount: 0, totalAmount: 0, outstandingAmount: 0 },
        };
      }
      return apiRequest<SettlementDetailResponse>(`/api/events/${eventId}/settlement/${encodeURIComponent(completedSettlementId)}`);
    },
    enabled: !!eventId && !!completedSettlementId,
    staleTime: 15_000,
    refetchInterval: eventId && completedSettlementId ? 5_000 : false,
    refetchOnWindowFocus: true,
  });
  const unpaidTransfers = Math.max(
    0,
    (activeFinalSettlementRound?.transferCount ?? 0) - (activeFinalSettlementRound?.paidTransfersCount ?? 0),
  );
  const myParticipant = user?.id
    ? participants.find((participant: { userId?: number | null }) => participant.userId === user.id) ?? null
    : null;
  const myBalance = myParticipant
    ? balances.find((entry) => entry.id === myParticipant.id) ?? null
    : null;
  const activityQuery = usePlanActivity(eventId, !!eventId);
  const activityItems = activityQuery.latestItems;
  const isCreator = Number(plan?.creatorUserId) === Number(user?.id);
  const hasAnyExpenses = laterSettleExpenses.length > 0;
  const hasOnlyCreator = participants.length <= 1;
  const allBalancesZero = balances.every((entry) => Math.abs(Number(entry.balance) || 0) < 0.01);
  const settlementCompleted = isFinanciallyCompleted || (!activeFinalSettlementRound && latestPastFinalSettlementRound?.status === "completed" && allBalancesZero);
  const personalStatus = useMemo<HeroStatus>(() => {
    if (isPlanArchived) {
      return { label: "Plan archived", tone: "muted", action: null };
    }
    if (isPlanSettled) {
      return { label: "Plan completed 🎉", tone: "settled", action: null };
    }
    if (isPlanClosed) {
      return { label: "Plan closed", tone: "muted", action: null };
    }
    if (hasOnlyCreator && !hasAnyExpenses) {
      return invitesLocked ? { label: "Invite locked", tone: "muted", action: null } : { label: "Invite Friends", tone: "cta-outline", action: "invite" };
    }
    if (!hasOnlyCreator && !hasAnyExpenses) {
      return expensesLocked ? { label: "Expenses locked", tone: "muted", action: null } : { label: "Add Expense", tone: "cta-primary", action: "expense" };
    }
    if (settlementCompleted) {
      return { label: "All settled", tone: "settled", action: null };
    }
    if (!myParticipant || !myBalance) return { label: "No personal split yet", tone: "muted", action: null };
    const amount = Number(myBalance.balance) || 0;
    if (Math.abs(amount) < 0.01) return { label: "All settled", tone: "settled", action: null };
    if (amount > 0) return { label: `You are owed ${formatCurrency(amount, currency)}`, tone: "positive", action: null };
    return { label: `You owe ${formatCurrency(Math.abs(amount), currency)}`, tone: "negative", action: null };
  }, [currency, expensesLocked, hasAnyExpenses, hasOnlyCreator, invitesLocked, isFinanciallyCompleted, isPlanArchived, isPlanClosed, isPlanSettled, myBalance, myParticipant, settlementCompleted]);
  const completedTransfers = completedSettlementDetailQuery.data?.transfers ?? [];
  const finalPayment = completedTransfers[0] ?? null;
  const planCreatedAt = formatFullDate((plan as { createdAt?: string | Date | null } | null)?.createdAt ?? null);
  const finalPlanState = getPlanFinalState(plan?.status, (plan as { settledAt?: string | Date | null } | null)?.settledAt ?? null);
  const planCompletedAt = formatFullDate(finalPlanState?.at ?? null);
  const wrapUpEndsAt = getPlanWrapUpEndsAt((plan as { settledAt?: string | Date | null } | null)?.settledAt ?? null);
  const wrapUpEndsLabel = formatFullDate(wrapUpEndsAt);

  const contributionRows = useMemo(() => {
    return buildCrewContributionRows({ participants, members, expenses: laterSettleExpenses }).map((row, index) => ({
      ...row,
      tint: avatarTint(index),
      isMe: row.id === myParticipant?.id,
    }));
  }, [laterSettleExpenses, members, myParticipant?.id, participants]);

  const topPayerId = contributionRows[0]?.id ?? null;
  const visibleContributors = contributionRows.slice(0, isMobile ? 3 : 5);
  const hiddenContributorCount = Math.max(contributionRows.length - visibleContributors.length, 0);
  const visibleActivityItems = activityItems.slice(0, isMobile ? 2 : 3);

  const openSettlement = (settlementId?: string, createMode?: "direct-split" | "balance-settlement") => replacePanel({ type: "settlement", settlementId, createMode });
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
    if (!eventId || expensesLocked) return;
    replacePanel({ type: "add-expense", source: "overview" });
  };
  const openInviteFlow = () => {
    if (invitesLocked) return;
    openInvite();
  };
  const heroActionHandlers: Partial<Record<Exclude<HeroStatusAction, null>, () => void>> = {
    invite: openInviteFlow,
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
    canSettle: isFinanciallyCompleted ? false : canSettle,
    latestSettlementStatus: isFinanciallyCompleted ? "completed" : activeFinalSettlementRound?.status ?? null,
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
  const upNextItem = activeFinalSettlementRound
    ? upNextCandidates.find((item) => item.type === "settlement") ?? {
        type: "settlement",
        title: "Settlement in progress",
        description: "Finish the remaining payments to complete the plan.",
        ctaLabel: "Open settle up",
        action: "settlement",
      }
    : expenses.length === 0
      ? {
          type: "expense" as const,
          title: "Start tracking expenses",
          description: "No expenses yet.",
          ctaLabel: expensesLocked ? null : "Add expense",
          action: expensesLocked ? null : "add-expense",
        }
      : allBalancesZero
        ? {
            type: "done" as const,
            title: "All good for now",
            description: "Expenses are tracked and there are no balances yet.",
            ctaLabel: null,
            action: null,
          }
        : {
            type: "settlement" as const,
            title: "Balances are ready to settle",
            description: "Open settle up to turn the current balances into payments.",
            ctaLabel: "Open settle up",
            action: "settlement",
          };
  const upNext = {
    ...upNextItem,
    onAction: upNextItem.action === "settlement"
      ? openSettlement
      : upNextItem.action === "invite"
        ? openInviteFlow
        : upNextItem.action === "add-expense"
          ? openAddExpenseFlow
      : upNextItem.action === "crew"
        ? openCrew
      : upNextItem.action === "plan-details"
        ? openPlanDetails
        : null,
  };

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
      : "text-slate-950 dark:text-white"
    : "text-foreground";
  const heroSecondaryTextClass = hasHeroBanner
    ? activeBannerTone === "light-content"
      ? "text-white/84"
      : "text-slate-900/72 dark:text-white/78"
    : "text-muted-foreground";
  const heroIconButtonClass = hasHeroBanner
    ? activeBannerTone === "light-content"
      ? "border-white/20 bg-black/25 text-white/90"
      : "border-black/10 bg-white/70 text-slate-900 dark:border-white/10 dark:bg-[hsl(var(--surface-1))]/88 dark:text-[hsl(var(--text-primary))]"
    : "";
  const heroPrimaryTextStyle = hasHeroBanner
    ? {
        color: activeBannerTone === "light-content"
          ? "rgba(255, 255, 255, 0.98)"
          : (typeof document !== "undefined" && document.documentElement.classList.contains("dark"))
            ? "rgba(255, 255, 255, 0.98)"
            : "rgba(2, 6, 23, 0.96)",
        textShadow: activeBannerTone === "light-content"
          ? "0 1px 10px rgba(0,0,0,0.18)"
          : (typeof document !== "undefined" && document.documentElement.classList.contains("dark"))
            ? "0 1px 10px rgba(0,0,0,0.22)"
            : undefined,
      }
    : undefined;
  const heroSecondaryTextStyle = hasHeroBanner
    ? {
        color: activeBannerTone === "light-content"
          ? "rgba(255, 255, 255, 0.84)"
          : (typeof document !== "undefined" && document.documentElement.classList.contains("dark"))
            ? "rgba(255, 255, 255, 0.78)"
            : "rgba(15, 23, 42, 0.72)",
      }
    : undefined;

  useEffect(() => {
    setBannerTone("light-content");
  }, [planBannerUrl]);

  const syncBannerLocally = (nextBannerUrl: string | null) => {
    if (!eventId) return;
    queryClient.setQueryData(queryKeys.plans.detail(eventId), (current: typeof plan | undefined) => (
      current ? { ...current, bannerImageUrl: nextBannerUrl } : current
    ));
    queryClient.setQueryData(queryKeys.plans.list(), (current: Array<Record<string, unknown>> | undefined) => (
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
      <div className={cn("flex items-center justify-between gap-4 rounded-t-[inherit] border-b border-neutral-200 bg-neutral-50 px-6 py-4 dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-1))]", isMobile && "px-3 py-2")}>
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

      <div className={cn("flex-1 space-y-4 overflow-y-auto px-5 py-5", isMobile && "space-y-2.5 px-3 pb-[4.5rem] pt-2.5")}>
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
            {isFinanciallyCompleted ? (
              <section
                className={cn(
                  "rounded-[18px] border border-emerald-200/80 bg-emerald-50/70 p-4 dark:border-emerald-500/25 dark:bg-emerald-500/10",
                  isMobile && "p-3",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-background/80 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-background/15 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {isPlanArchived ? "Plan archived" : "Plan completed 🎉"}
                    </div>
                    <p className="mt-3 text-sm font-semibold tracking-tight text-foreground">All balances settled</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatCurrency(totalShared, currency)} shared across {expenses.length} expense{expenses.length === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {participants.length} people participated
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isPlanArchived
                        ? "The wrap-up window has ended. This plan is now fully read-only."
                        : `All balances are settled. Chat stays open until ${wrapUpEndsLabel ?? "soon"}.`}
                    </p>
                  </div>
                  {planCompletedAt ? (
                    <div className="rounded-xl border border-emerald-200/70 bg-background/70 px-3 py-2 text-right dark:border-emerald-500/20 dark:bg-background/10">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{finalPlanState?.label ?? "Completed"}</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{planCompletedAt}</p>
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-background/60 px-3 py-3 dark:bg-[hsl(var(--surface-2))]/65">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Created</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{planCreatedAt ?? "Unavailable"}</p>
                  </div>
                  <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-background/60 px-3 py-3 dark:bg-[hsl(var(--surface-2))]/65">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Final payment</p>
                    {finalPayment ? (
                      <>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          <span>{finalPayment.fromName || "Someone"}</span>
                          <span className="text-muted-foreground"> → </span>
                          <span>{finalPayment.toName || "Someone"}</span>
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {formatCurrency(Number(finalPayment.amount || 0), finalPayment.currency || currency)}
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">Settlement completed successfully.</p>
                    )}
                  </div>
                </div>
              </section>
            ) : isPlanClosed ? (
              <section
                className={cn(
                  "rounded-[18px] border border-amber-200/80 bg-amber-50/80 p-4 dark:border-amber-500/25 dark:bg-amber-500/10",
                  isMobile && "p-3",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-background/80 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-background/15 dark:text-amber-300">
                      Plan closed
                    </div>
                    <p className="mt-3 text-sm font-semibold tracking-tight text-foreground">Planning is read-only now</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      No new invites or expenses can be added. You can still finish settle up if balances remain.
                    </p>
                  </div>
                </div>
              </section>
            ) : isPlanArchived ? null : (
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
                  ) : upNext.type === "done" ? (
                    <span className="rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground dark:bg-[hsl(var(--surface-2))]/90">
                      For now
                    </span>
                  ) : null}
                </div>
              </section>
            )}

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
