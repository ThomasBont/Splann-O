export function formatSettlementRoundTitle(
  title: string | null | undefined,
  roundType: "balance_settlement" | "direct_split" | null | undefined,
) {
  const trimmed = String(title ?? "").trim();
  if (roundType === "direct_split") {
    return trimmed || "Settle now";
  }

  if (!trimmed) {
    return "Final settlement";
  }

  const finalSettlementMatch = trimmed.match(/^final settlement(?:\s+(\d+))?$/i);
  if (!finalSettlementMatch) {
    return trimmed;
  }

  const roundNumber = Number(finalSettlementMatch[1] ?? "1");
  if (!Number.isFinite(roundNumber) || roundNumber <= 1) {
    return "Final settlement";
  }

  return `Settlement round ${roundNumber}`;
}
