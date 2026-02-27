import { z } from "zod";
import { normalizeCountryCode, COUNTRY_CODE_ERROR } from "@shared/lib/country-code";
import { optionalCountryCodeSchema } from "@shared/lib/country-code-schema";

const createEventSchema = z.object({
  name: z.string().min(1),
  countryCode: optionalCountryCodeSchema.nullable().optional(),
});

// A) No location / no country code => valid
const noLocation = createEventSchema.parse({ name: "No location event" });
if (noLocation.countryCode !== undefined) {
  throw new Error("Expected missing countryCode to stay undefined");
}

// B) Lowercase alpha-2 => normalized to uppercase
const lowercase = createEventSchema.parse({ name: "Lowercase country", countryCode: "nl" });
if (lowercase.countryCode !== "NL") {
  throw new Error(`Expected NL, got ${String(lowercase.countryCode)}`);
}

// C) Empty string => treated as undefined (no validation error)
const empty = createEventSchema.parse({ name: "Empty country", countryCode: "" });
if (empty.countryCode !== undefined) {
  throw new Error("Expected empty string countryCode to become undefined");
}

// D) Invalid non-empty code => rejected
let invalidRejected = false;
try {
  createEventSchema.parse({ name: "Invalid country", countryCode: "NLD" });
} catch (error) {
  invalidRejected = true;
  const message = error instanceof z.ZodError ? error.issues[0]?.message ?? "" : String(error);
  if (!message.includes(COUNTRY_CODE_ERROR)) {
    throw new Error(`Unexpected error message: ${message}`);
  }
}
if (!invalidRejected) {
  throw new Error("Expected invalid countryCode to fail validation");
}

if (normalizeCountryCode(" country.nl ") !== "NL") {
  throw new Error("normalizeCountryCode should strip prefix and uppercase");
}

console.log("country-code.verify: ok");

