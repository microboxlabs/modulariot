/**
 * Client-facing shape of a knowledge candidate from the semantic-layer learning
 * loop's staging store. Declared here (not imported from the server-only
 * `candidates-client`) so client components stay free of server imports.
 */
export interface KnowledgeCandidate {
  id: string;
  connection: string;
  term: string;
  kind: string | null;
  scope: string;
  confidence: number | null;
  body: string;
  status: string;
  createdBy: string | null;
  reviewedBy: string | null;
}

/** Response of the review route: the transitioned candidate + apply status. */
export interface ReviewResult {
  candidate: KnowledgeCandidate;
  cardApplied?: boolean;
  error?: string;
}

/** An approved card the chat agent grounds on, as the harness lists it. */
export interface KnowledgeCard {
  id: string;
  title: string | null;
  term: string | null;
  kind: string | null;
  scope: string | null;
  body: string;
  updated_at: string | null;
}

/** The cards of one connection; `error` marks a connection whose list failed. */
export interface ConnectionCards {
  connection: string;
  cards: KnowledgeCard[];
  error?: boolean;
}
