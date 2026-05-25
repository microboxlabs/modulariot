import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { extname, join } from "node:path";
import { sessionFile, sessionsDir } from "./paths.js";
import type { SessionState, TranscriptItem } from "../session/types.js";

export const TRANSCRIPT_CAP = 500;

export interface SessionSummary {
  id: string;
  lastTurn: number;
  lastPrompt: string | null;
  mtime: number;
}

export function writeSession(home: string, state: SessionState): void {
  const dir = sessionsDir(home);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const capped = capTranscript(state);
  const path = sessionFile(home, state.meta.conversationId);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(capped, null, 2), { mode: 0o600 });
  renameSync(tmp, path);
  if (process.platform !== "win32") chmodSync(path, 0o600);
}

export function readSession(
  home: string,
  conversationId: string,
): SessionState | null {
  const path = sessionFile(home, conversationId);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  try {
    return JSON.parse(raw) as SessionState;
  } catch {
    return null;
  }
}

export function listSessions(home: string): SessionSummary[] {
  const dir = sessionsDir(home);
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir);
  const summaries: SessionSummary[] = [];
  for (const name of entries) {
    if (extname(name) !== ".json") continue;
    if (name.endsWith(".tmp.json")) continue;
    const id = name.slice(0, -".json".length);
    const path = join(dir, name);
    let state: SessionState | null = null;
    try {
      state = JSON.parse(readFileSync(path, "utf8")) as SessionState;
    } catch {
      continue;
    }
    const mtime = statSync(path).mtimeMs;
    summaries.push({
      id,
      lastTurn: lastTurnCount(state),
      lastPrompt: lastUserPrompt(state),
      mtime,
    });
  }
  summaries.sort((a, b) => b.mtime - a.mtime);
  return summaries;
}

export function deleteSession(home: string, conversationId: string): boolean {
  const path = sessionFile(home, conversationId);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}

function capTranscript(state: SessionState): SessionState {
  if (state.transcript.length <= TRANSCRIPT_CAP) return state;
  // Reserve one slot for the summary so the final transcript has exactly
  // TRANSCRIPT_CAP items.
  const dropped = state.transcript.length - (TRANSCRIPT_CAP - 1);
  const summary: TranscriptItem = {
    kind: "system",
    id: "summary-elided",
    text: `(elided ${dropped} earlier item${dropped === 1 ? "" : "s"})`,
    ts: state.transcript[0]?.ts ?? "",
  };
  return {
    ...state,
    transcript: [summary, ...state.transcript.slice(dropped)],
  };
}

function lastTurnCount(state: SessionState | null): number {
  if (!state) return 0;
  return state.transcript.filter((i) => i.kind === "user").length;
}

function lastUserPrompt(state: SessionState | null): string | null {
  if (!state) return null;
  for (let i = state.transcript.length - 1; i >= 0; i -= 1) {
    const item = state.transcript[i];
    if (item && item.kind === "user") return item.text;
  }
  return null;
}
