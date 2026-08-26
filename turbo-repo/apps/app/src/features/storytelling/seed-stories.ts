import type { StoryItem } from "./storytelling.types";

/** Default entries so the list isn't empty before anything's been created from chat. */
export const SEED_STORIES: readonly StoryItem[] = [
  { id: "fleet-performance", title: "Fleet Performance Overview", createdAt: "2026-08-01", source: "seed" },
  { id: "onboarding-journey", title: "Driver Onboarding Journey", createdAt: "2026-07-20", source: "seed" },
  { id: "quarterly-review", title: "Quarterly Business Review", createdAt: "2026-07-10", source: "seed" },
];
