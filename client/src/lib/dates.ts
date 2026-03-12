export function formatFullDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatShortEnglishDate(value?: string | Date | null, options?: { weekday?: boolean }) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    ...(options?.weekday ? { weekday: "short" } : {}),
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function toValidDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatPlanDateRange(startValue?: string | Date | null, endValue?: string | Date | null, fallbackValue?: string | Date | null) {
  const startDate = toValidDate(startValue ?? fallbackValue ?? null);
  const endDate = toValidDate(endValue ?? startValue ?? fallbackValue ?? null);
  if (!startDate || !endDate) return formatFullDate(fallbackValue ?? startValue ?? endValue ?? null);

  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const sameMonth = sameYear && startDate.getMonth() === endDate.getMonth();
  const sameDay = sameMonth && startDate.getDate() === endDate.getDate();
  if (sameDay) return formatFullDate(startDate);

  const startFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const endFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  if (sameMonth) {
    return `${new Intl.DateTimeFormat("en-US", { month: "long" }).format(startDate)} ${startDate.getDate()}-${endDate.getDate()}, ${endDate.getFullYear()}`;
  }
  return `${startFormatter.format(startDate)} - ${endFormatter.format(endDate)}`;
}
