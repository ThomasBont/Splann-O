import {
  Backpack,
  Briefcase,
  CakeSlice,
  CalendarDays,
  Car,
  Clapperboard,
  Flame,
  Gamepad2,
  Glasses,
  MapPin,
  MountainSnow,
  Music,
  PartyPopper,
  Plane,
  Sun,
  Table2,
  Tag,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { PlanMainType, PlanSubcategoryId } from "@shared/lib/plan-types";

export function normalizeKey(input: string | null | undefined): string {
  const normalized = (input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[’'".,!?()/]/g, "")
    .replace(/\s+/g, " ");

  // Backward compatibility for legacy stored value.
  if (normalized === "brunch") return "picnic";
  return normalized;
}

export function getMainTypeIcon(mainType: PlanMainType | string | null | undefined): LucideIcon {
  const key = normalizeKey(mainType);
  if (key === "trip") return Plane;
  if (key === "party") return PartyPopper;
  if (key === "hangout") return Users;
  if (key === "dinner") return UtensilsCrossed;
  return Tag;
}

export function getSubTypeIcon(
  mainType: PlanMainType | string | null | undefined,
  subType: PlanSubcategoryId | string | null | undefined,
): LucideIcon {
  const key = normalizeKey(subType);

  const explicitSubtypeMap: Record<string, LucideIcon> = {
    // Party
    barbecue: Flame,
    bbq: Flame,
    cinema: Clapperboard,
    "game night": Gamepad2,
    gamenight: Gamepad2,
    dinner: UtensilsCrossed,
    birthday: CakeSlice,
    "house party": PartyPopper,
    "drinks night": Glasses,
    drinks: Glasses,
    picnic: Table2,

    // Trip
    backpacking: Backpack,
    "city trip": MapPin,
    citytrip: MapPin,
    "road trip": Car,
    roadtrip: Car,
    workation: Briefcase,
    "beach getaway": Sun,
    "ski trip": MountainSnow,
    "weekend escape": CalendarDays,
    "festival trip": Music,
  };

  if (explicitSubtypeMap[key]) return explicitSubtypeMap[key];

  // Keep a deterministic fallback per main type before generic fallback.
  const normalizedMain = normalizeKey(mainType);
  if (normalizedMain === "trip") return Plane;
  if (normalizedMain === "party") return PartyPopper;
  return Tag;
}

export function getPlanIcons(
  mainType: PlanMainType | string | null | undefined,
  subType: PlanSubcategoryId | string | null | undefined,
): [LucideIcon, LucideIcon] {
  return [getMainTypeIcon(mainType), getSubTypeIcon(mainType, subType)];
}
