import type { DeckContent, StoryItem } from "./storytelling.types";

/** Also reused by storytelling-store.ts's addStoriesForAllTypes — the
 * chat's create_story trigger doesn't generate real ppt content yet, so it
 * clones this same fixture rather than a thin placeholder deck. */
export const BOARD_DECK: DeckContent = {
  slides: [
    { type: "title", title: "Board Deck", subtitle: "Testing content for the storytelling PPT previewer — not a real deck." },
    {
      type: "bullets",
      title: "Agenda",
      items: [
        "Q3 performance overview",
        "Fleet utilization trends",
        "Incident response times",
        "Roadmap for Q4",
      ],
    },
    {
      type: "table",
      title: "Previewer status",
      headers: ["Component", "Status"],
      rows: [
        ["HTML previewer", "Working"],
        ["Markdown previewer", "Working"],
        ["PPT previewer", "Working"],
        ["PDF previewer", "Working"],
      ],
    },
    { type: "title", title: "Thanks!", subtitle: "board-deck-demo — storytelling PPT test fixture" },
  ],
};

/** Default entries so the list isn't empty before anything's been created
 * from chat — one of each artifact type (previewers/html, /markdown, /ppt,
 * /pdf), so every previewer is reachable without needing a real
 * chat-generated artifact of each kind yet. */
export const SEED_STORIES: readonly StoryItem[] = [
  { id: "fleet-performance", title: "Fleet Performance Overview", createdAt: "2026-08-01", createdBy: "Ana Fuentes", updatedAt: "2026-08-18", updatedBy: "Bruno Salinas", source: "seed", artifactType: "html" },
  { id: "release-notes-demo", title: "Release Notes", createdAt: "2026-08-20", createdBy: "Carla Méndez", updatedAt: "2026-08-20", updatedBy: "Carla Méndez", source: "seed", artifactType: "markdown" },
  { id: "board-deck-demo", title: "Board Deck", createdAt: "2026-08-21", createdBy: "Diego Rojas", updatedAt: "2026-08-27", updatedBy: "Elena Paredes", source: "seed", artifactType: "ppt", deck: BOARD_DECK },
  { id: "audit-report-demo", title: "Audit Report", createdAt: "2026-08-22", createdBy: "Felipe Ortega", updatedAt: "2026-08-24", updatedBy: "Felipe Ortega", source: "seed", artifactType: "pdf" },
];
