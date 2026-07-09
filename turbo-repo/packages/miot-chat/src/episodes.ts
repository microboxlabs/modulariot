// Interaction-episode capture for the CLI (semantic-layer continual-learning
// loop). The CLI already holds an org-scoped harness base URL + a bearer token
// (see cli.ts / config.ts), so it can POST straight to the modulith's
// user-authed episodes endpoint — deriving that URL from the harness base.

export interface CliEpisodeBody {
  surface: "cli";
  runId?: string;
  signal?: string;
  payload?: Record<string, unknown>;
}

export type EpisodeRecorder = (body: CliEpisodeBody) => void;

/**
 * Map the org-scoped harness base URL to the interactions endpoint:
 * `.../orgs/{org}/harness` → `.../orgs/{org}/interactions/episodes`. Returns
 * null when the base is not the org-scoped harness path (a bare/dev URL with no
 * `/harness` suffix), in which case episode capture is silently disabled.
 */
export function episodesUrlFromHarnessBase(harnessBaseUrl: string): string | null {
  const trimmed = harnessBaseUrl.replace(/\/+$/, "");
  const suffix = "/harness";
  if (!trimmed.endsWith(suffix)) return null;
  return `${trimmed.slice(0, -suffix.length)}/interactions/episodes`;
}

/**
 * Build a best-effort episode recorder. A failure only loses one learning
 * signal — it never throws and never blocks the TUI. A no-op when the base URL
 * is not org-scoped (episodesUrl null). `fetchImpl` is injectable for tests.
 */
export function makeEpisodeRecorder(args: {
  harnessBaseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
}): EpisodeRecorder {
  const url = episodesUrlFromHarnessBase(args.harnessBaseUrl);
  const doFetch = args.fetchImpl ?? fetch;
  return (body: CliEpisodeBody): void => {
    if (!url) return;
    void doFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(args.token ? { Authorization: `Bearer ${args.token}` } : {}),
      },
      body: JSON.stringify(body),
    }).catch(() => {});
  };
}
