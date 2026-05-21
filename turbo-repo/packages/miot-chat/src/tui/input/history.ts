import {
  chmodSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

export const HISTORY_CAP = 200;

export interface HistoryStore {
  entries: string[];
  cursor: number;
}

export function initialHistory(): HistoryStore {
  return { entries: [], cursor: -1 };
}

export function appendHistory(
  store: HistoryStore,
  text: string,
): HistoryStore {
  if (text.trim().length === 0) return resetCursor(store);
  const lastIdx = store.entries.length - 1;
  if (lastIdx >= 0 && store.entries[lastIdx] === text) {
    return resetCursor(store);
  }
  const next =
    store.entries.length >= HISTORY_CAP
      ? [...store.entries.slice(store.entries.length - HISTORY_CAP + 1), text]
      : [...store.entries, text];
  return { entries: next, cursor: -1 };
}

function resetCursor(store: HistoryStore): HistoryStore {
  if (store.cursor === -1) return store;
  return { entries: store.entries, cursor: -1 };
}

export function navUp(
  store: HistoryStore,
): { store: HistoryStore; text: string | null } {
  if (store.entries.length === 0) {
    return { store, text: null };
  }
  const target =
    store.cursor === -1
      ? store.entries.length - 1
      : Math.max(0, store.cursor - 1);
  const text = store.entries[target] ?? null;
  return { store: { entries: store.entries, cursor: target }, text };
}

export function navDown(
  store: HistoryStore,
): { store: HistoryStore; text: string | null } {
  if (store.cursor === -1) {
    return { store, text: null };
  }
  const next = store.cursor + 1;
  if (next >= store.entries.length) {
    return { store: { entries: store.entries, cursor: -1 }, text: "" };
  }
  const text = store.entries[next] ?? null;
  return { store: { entries: store.entries, cursor: next }, text };
}

export function loadHistorySync(filePath: string): HistoryStore {
  // History is a UX convenience (up-arrow recall). Disk failures —
  // TOCTOU race between existsSync and readFileSync, permission flip,
  // path now points to a directory — degrade silently to an empty
  // in-memory history instead of taking down the TUI.
  try {
    if (!existsSync(filePath)) return initialHistory();
    const raw = readFileSync(filePath, "utf8");
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l)
      .filter((l) => l.trim().length > 0);
    const trimmed =
      lines.length > HISTORY_CAP
        ? lines.slice(lines.length - HISTORY_CAP)
        : lines;
    return { entries: trimmed, cursor: -1 };
  } catch {
    return initialHistory();
  }
}

export function saveHistorySync(filePath: string, store: HistoryStore): void {
  // Same trade-off as loadHistorySync: persistence is a nicety. If
  // we can't write (EACCES, ENOSPC, parent dir deleted, chmod of a
  // vanished file), skip and keep the in-memory store usable.
  try {
    const body =
      store.entries.join("\n") + (store.entries.length > 0 ? "\n" : "");
    writeFileSync(filePath, body, { mode: 0o600 });
    // writeFileSync only applies the mode flag when the file is newly
    // created; explicitly re-chmod existing files so secrets in stale
    // history can't be read by other local users.
    if (process.platform !== "win32") {
      chmodSync(filePath, 0o600);
    }
  } catch {
    // Silently fall back to in-memory history.
  }
}
