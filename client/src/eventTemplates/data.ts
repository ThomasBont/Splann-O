import type { Barbecue } from "@shared/schema";

export type BarbecueRole = {
  id: string;
  label: string;
  description?: string;
  assignedTo?: string | null;
};

export type BarbecueTemplateData = {
  roles: BarbecueRole[];
  /** Custom expense categories added by the event creator. */
  customCategories?: string[];
};

export const defaultBarbecueTemplateData: BarbecueTemplateData = {
  roles: [
    {
      id: "grill_master",
      label: "Grill master",
      description: "Manages the grill so everything is perfectly cooked.",
    },
    {
      id: "drinks",
      label: "Drinks",
      description: "Keeps everyone’s glasses filled and drinks chilled.",
    },
    {
      id: "sides_salads",
      label: "Sides & salads",
      description: "Coordinates bread, salads, and vegetarian options.",
    },
  ],
  customCategories: [],
};

export type BirthdayContribution = {
  participantId: number;
  amount: number;
};

export type BirthdayTemplateData = {
  contributions: BirthdayContribution[];
  /** Custom expense categories added by the event creator. */
  customCategories?: string[];
};

export const defaultBirthdayTemplateData: BirthdayTemplateData = {
  contributions: [],
  customCategories: [],
};

/**
 * Safely read templateData from an event and merge it with defaults.
 * Falls back to defaults on any parse/shape issue.
 */
export function getTemplateData<T>(
  event: { templateData?: unknown | null } | Barbecue | null | undefined,
  defaults: T,
): T {
  if (!event || event == null) return defaults;
  const raw = (event as any).templateData;
  if (raw == null) return defaults;
  if (typeof raw !== "object") return defaults;
  try {
    return { ...defaults, ...(raw as Partial<T>) };
  } catch {
    return defaults;
  }
}

