export type ReceiptParseConfidence = {
  merchant: number;
  amount: number;
  date: number;
};

export type ParsedReceiptFields = {
  rawText: string;
  merchant?: string;
  amount?: number;
  date?: string;
  confidence: ReceiptParseConfidence;
};

const TOTAL_KEYWORD_RE = /\b(total|grand total|amount due|total due|totaal|importe total|importe|totale|sum|due)\b/i;
const EXCLUDED_TOTAL_LINE_RE = /\b(subtotal|sub total|tax|vat|cash|change|approval|approved|card|bank card|mastercard|visa|amex|pin|debit|credit|tip|auth)\b/i;
const GENERIC_MERCHANT_RE = /\b(shop name|store name|cash receipt|receipt|invoice|address|addr|tel|phone|fax|merchant copy|customer copy|transaction|order|table|server)\b/i;
const ADDRESS_RE = /\b(street|st\\.?|road|rd\\.?|avenue|ave\\.?|laan|weg|plaza|plein|calle|via|straat|postcode|postal|zip)\b/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/;
const VAT_RE = /\b(vat|btw|tax id|fiscal|cif|nif|iva)\b/i;
const DATE_PATTERNS = [
  /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/,
  /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/,
];

type AmountCandidate = {
  amount: number;
  line: string;
  index: number;
  score: number;
};

function normalizeLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

function normalizeReceiptLines(rawText: string) {
  return rawText
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);
}

function parseAmountToken(token: string): number | null {
  const cleaned = token.replace(/[^\d,.\-]/g, "").trim();
  if (!cleaned) return null;

  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",")) {
    normalized = cleaned.replace(",", ".");
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) return null;
  return Number(amount.toFixed(2));
}

function extractLineAmounts(line: string): number[] {
  const matches = line.match(/(?:[€$£]\s*)?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|(?:[€$£]\s*)?\d+(?:[.,]\d{2})/g) ?? [];
  return matches
    .map((entry) => parseAmountToken(entry))
    .filter((value): value is number => value != null);
}

function looksLikeMerchant(line: string) {
  if (line.length < 3 || line.length > 60) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(line)) return false;
  if (/^\d[\d\s-]*$/.test(line)) return false;
  if (GENERIC_MERCHANT_RE.test(line)) return false;
  if (ADDRESS_RE.test(line)) return false;
  if (PHONE_RE.test(line)) return false;
  if (VAT_RE.test(line)) return false;
  if (TOTAL_KEYWORD_RE.test(line)) return false;
  if (EXCLUDED_TOTAL_LINE_RE.test(line)) return false;
  return true;
}

export function extractMerchant(lines: string[]): { value?: string; confidence: number } {
  const candidates = lines.slice(0, 8);
  for (let index = 0; index < candidates.length; index += 1) {
    const line = normalizeLine(candidates[index]);
    if (!looksLikeMerchant(line)) continue;
    const confidence = index === 0 ? 0.94 : index <= 2 ? 0.88 : 0.78;
    return { value: line, confidence };
  }
  return { confidence: 0 };
}

function parseDateFromLine(line: string): string | null {
  for (let i = 0; i < DATE_PATTERNS.length; i += 1) {
    const match = line.match(DATE_PATTERNS[i]);
    if (!match) continue;
    let year: number;
    let month: number;
    let day: number;
    if (i === 0) {
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
    } else {
      day = Number(match[1]);
      month = Number(match[2]);
      year = Number(match[3]);
    }
    if (year < 100) year += 2000;
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  }
  return null;
}

export function extractDate(lines: string[]): { value?: string; confidence: number } {
  for (const rawLine of lines.slice(0, 16)) {
    const parsed = parseDateFromLine(rawLine);
    if (parsed) {
      return { value: parsed, confidence: 0.82 };
    }
  }
  return { confidence: 0 };
}

function collectAmountCandidates(lines: string[]) {
  return lines.flatMap((rawLine, index) => {
    const line = normalizeLine(rawLine);
    const amounts = extractLineAmounts(line);
    return amounts.map((amount) => {
      let score = 0.25;
      if (TOTAL_KEYWORD_RE.test(line)) score += 0.6;
      if (EXCLUDED_TOTAL_LINE_RE.test(line)) score -= 0.45;
      if (index >= Math.floor(lines.length / 2)) score += 0.15;
      if (index >= Math.floor(lines.length * 0.7)) score += 0.1;
      if (amount >= 1) score += 0.05;
      return { amount, line, index, score };
    });
  });
}

export function extractTotal(lines: string[]): { value?: number; confidence: number } {
  const candidates = collectAmountCandidates(lines);
  const preferred = candidates.filter((candidate) => TOTAL_KEYWORD_RE.test(candidate.line) && !EXCLUDED_TOTAL_LINE_RE.test(candidate.line));
  if (preferred.length > 0) {
    const chosen = preferred[preferred.length - 1];
    return { value: chosen.amount, confidence: Math.min(0.98, Math.max(0.78, chosen.score)) };
  }

  const lowerHalf = candidates.filter((candidate) => candidate.index >= Math.floor(lines.length / 2) && !EXCLUDED_TOTAL_LINE_RE.test(candidate.line));
  if (lowerHalf.length > 0) {
    const chosen = lowerHalf[lowerHalf.length - 1];
    return { value: chosen.amount, confidence: Math.min(0.72, Math.max(0.45, chosen.score)) };
  }

  const plausible = candidates.filter((candidate) => !EXCLUDED_TOTAL_LINE_RE.test(candidate.line));
  if (plausible.length > 0) {
    const chosen = plausible[plausible.length - 1];
    return { value: chosen.amount, confidence: 0.35 };
  }

  return { confidence: 0 };
}

export function parseReceiptText(rawText: string): ParsedReceiptFields {
  const lines = normalizeReceiptLines(rawText);
  const merchant = extractMerchant(lines);
  const amount = extractTotal(lines);
  const date = extractDate(lines);

  return {
    rawText,
    ...(merchant.value ? { merchant: merchant.value } : {}),
    ...(amount.value != null ? { amount: amount.value } : {}),
    ...(date.value ? { date: date.value } : {}),
    confidence: {
      merchant: merchant.confidence,
      amount: amount.confidence,
      date: date.confidence,
    },
  };
}
