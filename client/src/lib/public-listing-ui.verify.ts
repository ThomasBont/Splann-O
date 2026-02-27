import { getListingBadgeLabel, isPublicEvent, shouldShowPendingPublish } from "./public-listing-ui";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const privateEvent = {
  id: 1,
  visibility: "private",
  visibilityOrigin: "private",
  publicListingStatus: "inactive",
  status: "active",
};

const publicDraftIntent = {
  id: 2,
  visibility: "private",
  visibilityOrigin: "public",
  publicListingStatus: "inactive",
  status: "draft",
};

const publicListed = {
  id: 3,
  visibility: "public",
  visibilityOrigin: "public",
  publicListingStatus: "active",
  status: "active",
};

const corruptedPrivateLike = {
  id: 4,
  visibility: "private",
  visibilityOrigin: "public",
  publicListingStatus: "inactive",
  status: "active",
};

assert(isPublicEvent(privateEvent) === false, "private event must render private UI");
assert(shouldShowPendingPublish(privateEvent) === false, "private events must not show pending publish");
assert(getListingBadgeLabel(privateEvent) === null, "private events must not get a listing badge");

assert(isPublicEvent(publicDraftIntent) === true, "public-intent draft/unlisted event must render public UI");
assert(shouldShowPendingPublish(publicDraftIntent) === true, "public-intent draft/unlisted should show pending publish");
assert(getListingBadgeLabel(publicDraftIntent) === "Pending publish", "public-intent draft should get Pending publish label");

assert(isPublicEvent(publicListed) === true, "listed public event must render public UI");
assert(shouldShowPendingPublish(publicListed) === false, "listed public events must not show pending publish");
assert(getListingBadgeLabel(publicListed) === null, "listed public events must not get pending publish label");

assert(isPublicEvent(corruptedPrivateLike) === true, "canonical helper only uses visibility/type fields; backend repair/normalization handles corrupted rows");

console.log("public-listing-ui.verify: ok");
