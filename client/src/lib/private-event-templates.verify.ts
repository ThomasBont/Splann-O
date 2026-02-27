import { strict as assert } from "node:assert";
import {
  getPrivateTemplateById,
  inferPrivateTemplateIdFromEvent,
} from "@/lib/private-event-templates";

assert.equal(inferPrivateTemplateIdFromEvent({ eventType: "city_trip" }), "trip");
assert.equal(inferPrivateTemplateIdFromEvent({ eventType: "dinner_party" }), "dinner");
assert.equal(inferPrivateTemplateIdFromEvent({ eventType: "game_night" }), "game_night");
assert.equal(inferPrivateTemplateIdFromEvent({ eventType: "barbecue" }), "party");
assert.equal(getPrivateTemplateById("generic").label, "Generic");

console.log("private-event-templates.verify: ok");

