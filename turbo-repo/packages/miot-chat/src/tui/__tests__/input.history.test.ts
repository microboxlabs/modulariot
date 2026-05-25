import { describe, expect, it } from "vitest";
import {
  appendHistory,
  HISTORY_CAP,
  initialHistory,
  loadHistorySync,
  navDown,
  navUp,
  saveHistorySync,
  type HistoryStore,
} from "../input/history.js";
import { mkdtempSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function tempPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "miot-chat-hist-"));
  return join(dir, "history");
}

describe("history — append + dedupe + cap", () => {
  it("starts empty", () => {
    expect(initialHistory()).toEqual({ entries: [], cursor: -1 });
  });

  it("appendHistory adds an entry to the end", () => {
    let s: HistoryStore = initialHistory();
    s = appendHistory(s, "alpha");
    s = appendHistory(s, "beta");
    expect(s.entries).toEqual(["alpha", "beta"]);
  });

  it("appendHistory dedupes consecutive duplicates", () => {
    let s: HistoryStore = initialHistory();
    s = appendHistory(s, "x");
    s = appendHistory(s, "x");
    s = appendHistory(s, "y");
    s = appendHistory(s, "x");
    expect(s.entries).toEqual(["x", "y", "x"]);
  });

  it("appendHistory ignores empty / whitespace-only strings", () => {
    let s: HistoryStore = initialHistory();
    s = appendHistory(s, "");
    s = appendHistory(s, "  ");
    expect(s.entries).toEqual([]);
  });

  it("appendHistory caps entries at HISTORY_CAP, dropping oldest", () => {
    let s: HistoryStore = initialHistory();
    for (let i = 0; i < HISTORY_CAP + 5; i += 1) {
      s = appendHistory(s, `cmd-${i}`);
    }
    expect(s.entries).toHaveLength(HISTORY_CAP);
    expect(s.entries[0]).toBe(`cmd-5`);
    expect(s.entries[HISTORY_CAP - 1]).toBe(`cmd-${HISTORY_CAP + 4}`);
  });

  it("appendHistory resets the cursor (cancels nav)", () => {
    let s: HistoryStore = initialHistory();
    s = appendHistory(s, "a");
    s = appendHistory(s, "b");
    const up = navUp(s);
    expect(up.store.cursor).toBe(1);
    const next = appendHistory(up.store, "c");
    expect(next.cursor).toBe(-1);
  });
});

describe("history — nav up/down", () => {
  function seed(): HistoryStore {
    let s = initialHistory();
    for (const entry of ["one", "two", "three"]) {
      s = appendHistory(s, entry);
    }
    return s;
  }

  it("navUp from idle goes to most recent entry", () => {
    const r = navUp(seed());
    expect(r.text).toBe("three");
    expect(r.store.cursor).toBe(2);
  });

  it("navUp from oldest stays at oldest", () => {
    let s = seed();
    s = navUp(s).store;
    s = navUp(s).store;
    s = navUp(s).store;
    const r = navUp(s);
    expect(r.text).toBe("one");
    expect(r.store.cursor).toBe(0);
  });

  it("navDown from idle returns null and does nothing", () => {
    const r = navDown(seed());
    expect(r.text).toBeNull();
    expect(r.store.cursor).toBe(-1);
  });

  it("navDown past the most recent entry returns empty string and ends nav", () => {
    let s = seed();
    s = navUp(s).store;
    const r = navDown(s);
    expect(r.text).toBe("");
    expect(r.store.cursor).toBe(-1);
  });
});

describe("history — file persistence", () => {
  it("saveHistorySync + loadHistorySync round-trip the entries", () => {
    const path = tempPath();
    let s = initialHistory();
    s = appendHistory(s, "alpha");
    s = appendHistory(s, "beta");
    saveHistorySync(path, s);
    const loaded = loadHistorySync(path);
    expect(loaded.entries).toEqual(["alpha", "beta"]);
    expect(loaded.cursor).toBe(-1);
  });

  it("loadHistorySync returns empty store when file is absent", () => {
    const path = join(
      mkdtempSync(join(tmpdir(), "miot-hist-missing-")),
      "no-such-file",
    );
    const loaded = loadHistorySync(path);
    expect(loaded).toEqual(initialHistory());
  });

  it("loadHistorySync ignores blank lines from the file", () => {
    const path = tempPath();
    writeFileSync(path, "first\n\nsecond\n\n");
    const loaded = loadHistorySync(path);
    expect(loaded.entries).toEqual(["first", "second"]);
  });

  it("saveHistorySync writes the file with 0600 permissions", () => {
    if (process.platform === "win32") return;
    const path = tempPath();
    saveHistorySync(path, appendHistory(initialHistory(), "x"));
    const mode = statSync(path).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});

