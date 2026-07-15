import { logger } from "@/lib/logger";

/**
 * Body of an interaction episode (semantic-layer continual-learning loop).
 * `surface` is required; the modulith fills tenant + user from the caller's
 * session. `payload` is free-form (query, route/tools, answer, assumptions, a
 * clicked result id, …).
 */
export interface EpisodeBody {
  surface: "spotlight" | "cli";
  runId?: string;
  signal?: string;
  payload?: Record<string, unknown>;
}

/**
 * Best-effort append of an interaction episode to the modulith's user-authed
 * endpoint. Fire-and-forget: a failure here must never affect the user-facing
 * search — it only loses one learning signal, which we log and move on. Runs
 * server-side (holds the user token + org scope); the browser cannot reach the
 * modulith directly.
 */
export async function recordEpisode(args: {
  orgSlug: string;
  token: string | undefined;
  body: EpisodeBody;
}): Promise<void> {
  const host = process.env.MIOT_HARNESS_URL ?? "";
  if (!host) return;
  try {
    const res = await fetch(
      `${host}/api/v1/orgs/${args.orgSlug}/interactions/episodes`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(args.token ? { Authorization: `Bearer ${args.token}` } : {}),
        },
        body: JSON.stringify(args.body),
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!res.ok) {
      logger.warn(
        { status: res.status, surface: args.body.surface },
        "[interactions/episodes] episode write rejected",
      );
    }
  } catch (err) {
    logger.warn({ err }, "[interactions/episodes] episode write failed");
  }
}
