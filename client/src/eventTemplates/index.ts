export type { EventTemplate, EventTemplateKey, EventTemplateTheme, EventTemplateTokens, HeroStyle } from "./types";
export { EventTemplateWrapper } from "./EventTemplateWrapper";
export { templates, eventTypeToTemplateKey, getEventTemplate } from "./registry";
export {
  tripTemplates,
  TRIP_TYPE_KEYS,
  getTripTemplate,
  isTripEventType,
  type TripTemplate,
  type TripTypeKey,
  type ExpenseTemplate,
} from "./tripTemplates";
export {
  partyTemplates,
  PARTY_TYPE_KEYS,
  getPartyTemplate,
  isPartyEventType,
  type PartyTemplate,
  type PartyTypeKey,
  type RecommendedExpense,
} from "./partyTemplates";
export {
  getTemplateData,
  type BarbecueTemplateData,
  type BarbecueRole,
  type BirthdayTemplateData,
  type BirthdayContribution,
  defaultBarbecueTemplateData,
  defaultBirthdayTemplateData,
} from "./data";
