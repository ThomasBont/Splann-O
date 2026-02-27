import { z } from "zod";
import { COUNTRY_CODE_ERROR, normalizeCountryCode } from "./country-code";

export const optionalCountryCodeSchema = z.preprocess((value) => {
  if (value == null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  const normalized = normalizeCountryCode(value);
  return normalized ?? value;
}, z.string().regex(/^[A-Z]{2}$/, COUNTRY_CODE_ERROR).optional());

