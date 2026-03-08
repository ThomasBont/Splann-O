import type { PlanActivityItem } from "@/hooks/use-plan-activity";

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

export function formatActivityTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const time = date.getTime();
  if (!Number.isFinite(time)) return "";
  const diffMs = Date.now() - time;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function formatActivityPreview(
  item: Pick<PlanActivityItem, "type" | "actorName" | "message" | "meta">,
  currencyCode: string,
) {
  const actor = (item.actorName || "Someone").trim().split(/\s+/)[0] || "Someone";
  const meta = item.meta ?? {};
  const amount = typeof meta.amount === "number" ? meta.amount : Number(meta.amount);
  const currency = typeof meta.currency === "string" && meta.currency.trim() ? meta.currency : currencyCode;
  const title = typeof meta.title === "string"
    ? meta.title.trim()
    : item.type.startsWith("EXPENSE_")
      ? (() => {
          const match = item.message.match(/expense:\s*(.+?)\s*\((?:[A-Z]{3}|€|\$|£)/i);
          return match?.[1]?.trim() ?? "";
        })()
      : "";

  if (item.type === "EXPENSE_ADDED" && title) {
    return `${actor} added ${title}${Number.isFinite(amount) ? ` · ${formatCurrency(amount, currency)}` : ""}`;
  }
  if (item.type === "EXPENSE_DELETED" && title) {
    return `${actor} removed ${title}${Number.isFinite(amount) ? ` · ${formatCurrency(amount, currency)}` : ""}`;
  }
  if (item.type === "MEMBER_JOINED") {
    return `${actor} joined the plan`;
  }
  if (item.type === "PLAN_UPDATED") {
    return `${actor} updated the plan`;
  }
  if (item.type === "POLL_CREATED") {
    const question = typeof meta.question === "string" && meta.question.trim() ? meta.question.trim() : item.message.replace(/^.+?:\s*/, "");
    return `${actor} started a vote · ${question}`;
  }
  if (item.type === "POLL_VOTED") {
    const optionLabel = typeof meta.optionLabel === "string" ? meta.optionLabel.trim() : "";
    const question = typeof meta.question === "string" ? meta.question.trim() : "";
    return optionLabel
      ? `${actor} voted for ${optionLabel}${question ? ` · ${question}` : ""}`
      : `${actor} voted in a poll`;
  }
  if (item.type === "POLL_CLOSED") {
    const question = typeof meta.question === "string" ? meta.question.trim() : "";
    const winner = typeof meta.winnerOptionLabel === "string" ? meta.winnerOptionLabel.trim() : "";
    return winner
      ? `${actor} closed the vote · ${question || winner} · Winner: ${winner}`
      : `${actor} closed a vote${question ? ` · ${question}` : ""}`;
  }

  return item.message
    .replace(/^(.+?) added an expense:\s*/i, "$1 added ")
    .replace(/^(.+?) deleted an expense:\s*/i, "$1 removed ")
    .replace(/\s*\(([^)]+)\)\s*$/, " · $1")
    .trim();
}
