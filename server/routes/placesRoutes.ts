import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { fetchPlaceSuggestions } from "../lib/googlePlaces";

const router = Router();

router.get("/autocomplete", requireAuth, async (req, res, next) => {
  try {
    const rawQuery = typeof req.query.q === "string" ? req.query.q : "";
    const query = rawQuery.trim();
    if (query.length < 2) {
      return res.json({ suggestions: [] });
    }

    const languageCode = typeof req.query.languageCode === "string" ? req.query.languageCode : undefined;
    const regionCode = typeof req.query.regionCode === "string" ? req.query.regionCode : undefined;
    const suggestions = await fetchPlaceSuggestions({ query, languageCode, regionCode });
    return res.json({ suggestions });
  } catch (error) {
    return next(error);
  }
});

export default router;
