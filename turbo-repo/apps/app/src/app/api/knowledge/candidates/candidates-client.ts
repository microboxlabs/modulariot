import { logger } from "@/lib/logger";

/**
 * Server-side client for the semantic-layer learning loop's staging store. The
 * browser has no user token for the modulith, so these run in app API routes
 * that hold the session token + org scope. `MIOT_HARNESS_URL` is the modulith
 * base (same var the search + episode routes use); the modulith hosts both the
 * knowledge-candidates endpoints and the harness proxy.
 */

/** Body to stage a candidate — the connection + the proposed term MEANING. */
export interface CandidateBody {
  connection: string;
  term: string;
  kind?: string;
  scope?: string;
  confidence?: number;
  body: string;
  provenance?: Record<string, unknown>;
}

/** The modulith's KnowledgeCandidate (the fields the app renders + applies). */
export interface Candidate {
  id: string;
  connection: string;
  term: string;
  kind: string | null;
  scope: string;
  confidence: number | null;
  body: string;
  provenance: Record<string, unknown>;
  status: string;
  createdBy: string | null;
  reviewedBy: string | null;
}

export type Decision = "approve" | "reject";

function host(): string {
  return process.env.MIOT_HARNESS_URL ?? "";
}

async function modulith(
  path: string,
  token: string | undefined,
  init: RequestInit,
): Promise<Response> {
  const base = host();
  if (!base) throw new Error("MIOT_HARNESS_URL is not set");
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(10_000),
  });
}

export async function listCandidates(args: {
  orgSlug: string;
  token: string | undefined;
  status?: string;
  limit?: number;
}): Promise<Candidate[]> {
  const qs = new URLSearchParams({
    status: args.status ?? "pending",
    limit: String(args.limit ?? 100),
  });
  const res = await modulith(
    `/api/v1/orgs/${args.orgSlug}/knowledge/candidates?${qs}`,
    args.token,
    { method: "GET" },
  );
  if (!res.ok) throw new Error(`list candidates failed: ${res.status}`);
  return (await res.json()) as Candidate[];
}

export async function createCandidate(args: {
  orgSlug: string;
  token: string | undefined;
  body: CandidateBody;
}): Promise<Candidate> {
  const res = await modulith(
    `/api/v1/orgs/${args.orgSlug}/knowledge/candidates`,
    args.token,
    { method: "POST", body: JSON.stringify(args.body) },
  );
  if (!res.ok) throw new Error(`create candidate failed: ${res.status}`);
  return (await res.json()) as Candidate;
}

/**
 * Approves/rejects a candidate. Returns null on 404 (unknown or already
 * reviewed) so the route maps it to a 404 without conflating it with a 502.
 */
export async function reviewCandidate(args: {
  orgSlug: string;
  token: string | undefined;
  id: string;
  decision: Decision;
}): Promise<Candidate | null> {
  const res = await modulith(
    `/api/v1/orgs/${args.orgSlug}/knowledge/candidates/${encodeURIComponent(args.id)}/${args.decision}`,
    args.token,
    { method: "POST" },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${args.decision} candidate failed: ${res.status}`);
  return (await res.json()) as Candidate;
}

/**
 * The APPLY step: writes an approved candidate to the harness as a
 * connection-scoped card, through the modulith harness proxy (which injects the
 * tenant identity). Uses the candidate's SERVER-side fields (never client input)
 * so a tampered body can't reach the card. Throws on a non-2xx so the route can
 * report the approval succeeded but the apply did not (retryable).
 */
export async function writeHarnessCard(args: {
  orgSlug: string;
  token: string | undefined;
  candidate: Candidate;
  today: string;
}): Promise<void> {
  const c = args.candidate;
  const card = {
    term: c.term,
    body: c.body,
    scope: c.scope,
    ...(c.kind ? { kind: c.kind } : {}),
    ...(c.confidence != null ? { confidence: c.confidence } : {}),
    ...(c.reviewedBy ? { approved_by: c.reviewedBy } : {}),
    ...(c.provenance ? { provenance: c.provenance } : {}),
    last_confirmed: args.today,
  };
  const res = await modulith(
    `/api/v1/orgs/${args.orgSlug}/harness/connections/${encodeURIComponent(c.connection)}/knowledge`,
    args.token,
    { method: "POST", body: JSON.stringify(card) },
  );
  if (!res.ok) {
    logger.warn(
      { status: res.status, connection: c.connection, term: c.term },
      "[knowledge/candidates] harness card write rejected",
    );
    throw new Error(`harness card write failed: ${res.status}`);
  }
}
