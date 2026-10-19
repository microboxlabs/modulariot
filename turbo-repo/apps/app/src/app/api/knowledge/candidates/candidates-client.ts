import { logger } from "@/lib/logger";
import { modulithHost } from "@/lib/modulith-host";

/**
 * Server-side client for the semantic-layer learning loop's staging store. The
 * browser has no user token for the modulith, so these run in app API routes
 * that hold the session token + org scope. The base host comes from
 * `modulithHost()` (same host the search + episode routes use); the modulith
 * serves both the knowledge-candidates endpoints and the harness proxy.
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

/** An approved card as the harness lists it for a connection. */
export interface KnowledgeCard {
  id: string;
  title: string | null;
  term: string | null;
  kind: string | null;
  scope: string | null;
  body: string;
  updated_at: string | null;
}

/** A non-2xx modulith answer; routes pass 403 through and map the rest to 502. */
class ModulithStatusError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ModulithStatusError";
  }
}

const TRAINER_PERMISSION = "HARNESS_TRAINER";

/** The status a route answers for a failed modulith call. */
export function failureStatus(err: unknown): 403 | 502 {
  return err instanceof ModulithStatusError && err.status === 403 ? 403 : 502;
}

function host(): string {
  return modulithHost();
}

async function modulith(
  path: string,
  token: string | undefined,
  init: RequestInit
): Promise<Response> {
  const base = host();
  if (!base) throw new Error("MIOT_MODULITH_URL is not set");
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
    { method: "GET" }
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
    { method: "POST", body: JSON.stringify(args.body) }
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
    { method: "POST" }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new ModulithStatusError(
      `${args.decision} candidate failed: ${res.status}`,
      res.status
    );
  }
  return (await res.json()) as Candidate;
}

/** Edits a pending candidate's term and body. Null on 404 (unknown or already reviewed). */
export async function editCandidate(args: {
  orgSlug: string;
  token: string | undefined;
  id: string;
  term: string;
  body: string;
}): Promise<Candidate | null> {
  const res = await modulith(
    `/api/v1/orgs/${args.orgSlug}/knowledge/candidates/${encodeURIComponent(args.id)}`,
    args.token,
    {
      method: "PATCH",
      body: JSON.stringify({ term: args.term, body: args.body }),
    }
  );
  if (res.status === 404) return null;
  if (!res.ok)
    throw new ModulithStatusError(
      `edit candidate failed: ${res.status}`,
      res.status
    );
  return (await res.json()) as Candidate;
}

/** Whether the caller may review candidates and manage cards. */
export async function isTrainer(args: {
  orgSlug: string;
  token: string | undefined;
}): Promise<boolean> {
  const res = await modulith(
    `/api/v1/orgs/${args.orgSlug}/permissions/${TRAINER_PERMISSION}/me`,
    args.token,
    { method: "GET" }
  );
  if (!res.ok)
    throw new ModulithStatusError(
      `trainer check failed: ${res.status}`,
      res.status
    );
  const decision = (await res.json()) as { allowed?: boolean };
  return decision.allowed === true;
}

/** The connections the harness keeps learned facts on for this organization. */
export async function listKnowledgeConnections(args: {
  orgSlug: string;
  token: string | undefined;
}): Promise<string[]> {
  const res = await modulith(
    `/api/v1/orgs/${args.orgSlug}/harness/knowledge/connections`,
    args.token,
    { method: "GET" }
  );
  if (!res.ok)
    throw new ModulithStatusError(
      `list knowledge connections failed: ${res.status}`,
      res.status
    );
  const payload = (await res.json()) as { connections?: string[] };
  return payload.connections ?? [];
}

function knowledgePath(orgSlug: string, connection: string): string {
  return `/api/v1/orgs/${orgSlug}/harness/connections/${encodeURIComponent(connection)}/knowledge`;
}

export async function listCards(args: {
  orgSlug: string;
  token: string | undefined;
  connection: string;
}): Promise<KnowledgeCard[]> {
  const res = await modulith(
    knowledgePath(args.orgSlug, args.connection),
    args.token,
    {
      method: "GET",
    }
  );
  if (!res.ok)
    throw new ModulithStatusError(
      `list cards failed: ${res.status}`,
      res.status
    );
  const payload = (await res.json()) as { cards?: KnowledgeCard[] };
  return payload.cards ?? [];
}

/** Deletes one card. False on 404 (already gone). */
export async function deleteCard(args: {
  orgSlug: string;
  token: string | undefined;
  connection: string;
  cardId: string;
}): Promise<boolean> {
  const res = await modulith(
    `${knowledgePath(args.orgSlug, args.connection)}/${encodeURIComponent(args.cardId)}`,
    args.token,
    { method: "DELETE" }
  );
  if (res.status === 404) return false;
  if (!res.ok)
    throw new ModulithStatusError(
      `delete card failed: ${res.status}`,
      res.status
    );
  return true;
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
    knowledgePath(args.orgSlug, c.connection),
    args.token,
    {
      method: "POST",
      body: JSON.stringify(card),
    }
  );
  if (!res.ok) {
    logger.warn(
      { status: res.status, connection: c.connection, term: c.term },
      "[knowledge/candidates] harness card write rejected"
    );
    throw new Error(`harness card write failed: ${res.status}`);
  }
}
