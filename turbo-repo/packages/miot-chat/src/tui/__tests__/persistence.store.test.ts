import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  deleteSession,
  listSessions,
  readSession,
  TRANSCRIPT_CAP,
  writeSession,
} from "../persistence/store.js";
import { sessionsDir, sessionFile } from "../persistence/paths.js";
import { initialSession, reduce } from "../session/reducer.js";
import type { ReducerContext, SessionState } from "../session/types.js";

function mkHome(): string {
  return mkdtempSync(join(tmpdir(), "miot-chat-store-"));
}

function mkCtx(): ReducerContext {
  let n = 0;
  let i = 0;
  return {
    now: () => `2026-01-01T00:00:${String(n++).padStart(2, "0")}Z`,
    uuid: () => `id-${++i}`,
  };
}

function mkSession(convId: string, prompts: string[] = []): SessionState {
  const ctx = mkCtx();
  let state = initialSession(
    {
      tenantId: "t",
      userId: "u",
      mode: "auto",
      baseUrl: "http://x",
    },
    { ...ctx, uuid: () => convId },
  );
  // Re-bind ctx after init so subsequent uuids increment normally.
  const realCtx = mkCtx();
  for (const p of prompts) {
    state = reduce(state, { kind: "BEGIN_TURN", prompt: p }, realCtx);
  }
  return state;
}

describe("persistence store — write/read", () => {
  it("writeSession + readSession round-trip the state", () => {
    const home = mkHome();
    const session = mkSession("conv-1", ["hello", "world"]);
    writeSession(home, session);
    const loaded = readSession(home, "conv-1");
    expect(loaded).toEqual(session);
  });

  it("readSession returns null when the file is missing", () => {
    const home = mkHome();
    expect(readSession(home, "no-such-id")).toBeNull();
  });

  it("readSession returns null when the file is unparseable", () => {
    const home = mkHome();
    const path = sessionFile(home, "broken");
    // Create the sessions dir + a junk file.
    writeSession(home, mkSession("seed-conv"));
    writeFileSync(path, "{ this is not json");
    expect(readSession(home, "broken")).toBeNull();
  });

  it("writes the file with 0600 permissions", () => {
    if (process.platform === "win32") return;
    const home = mkHome();
    writeSession(home, mkSession("conv-perm"));
    const mode = statSync(sessionFile(home, "conv-perm")).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("writes are atomic via a .tmp + rename", () => {
    const home = mkHome();
    const session = mkSession("conv-atomic", ["one"]);
    writeSession(home, session);
    // Calling write again should leave no stray .tmp behind.
    writeSession(home, session);
    const path = sessionFile(home, "conv-atomic");
    expect(readFileSync(path, "utf8")).toContain("conv-atomic");
    expect(() => statSync(`${path}.tmp`)).toThrow();
  });

  it("caps the transcript at TRANSCRIPT_CAP and prepends an elision summary", () => {
    const home = mkHome();
    let session = mkSession("conv-cap");
    const ctx = mkCtx();
    for (let i = 0; i < TRANSCRIPT_CAP + 10; i += 1) {
      session = reduce(session, { kind: "BEGIN_TURN", prompt: `p-${i}` }, ctx);
    }
    writeSession(home, session);
    const loaded = readSession(home, "conv-cap");
    expect(loaded?.transcript.length).toBe(TRANSCRIPT_CAP);
    expect(loaded?.transcript[0]?.kind).toBe("system");
    expect(
      loaded && loaded.transcript[0]?.kind === "system"
        ? loaded.transcript[0].text
        : null,
    ).toContain("elided");
  });
});

describe("persistence store — listSessions", () => {
  it("returns empty when the dir does not exist", () => {
    const home = mkHome();
    expect(listSessions(home)).toEqual([]);
  });

  it("returns one summary per session sorted newest-first", async () => {
    const home = mkHome();
    writeSession(home, mkSession("a", ["pa1"]));
    await new Promise((r) => setTimeout(r, 15));
    writeSession(home, mkSession("b", ["pb1", "pb2"]));
    await new Promise((r) => setTimeout(r, 15));
    writeSession(home, mkSession("c", ["pc1"]));
    const list = listSessions(home);
    expect(list.map((s) => s.id)).toEqual(["c", "b", "a"]);
    expect(list[1]?.lastTurn).toBe(2);
    expect(list[1]?.lastPrompt).toBe("pb2");
  });

  it("ignores files that aren't .json", () => {
    const home = mkHome();
    writeSession(home, mkSession("a"));
    writeFileSync(join(sessionsDir(home), "stray.txt"), "junk");
    expect(listSessions(home).map((s) => s.id)).toEqual(["a"]);
  });

  it("skips entries that fail to parse", () => {
    const home = mkHome();
    writeSession(home, mkSession("a"));
    writeFileSync(join(sessionsDir(home), "broken.json"), "{not json");
    expect(listSessions(home).map((s) => s.id)).toEqual(["a"]);
  });
});

describe("persistence store — deleteSession", () => {
  it("removes the file and returns true", () => {
    const home = mkHome();
    writeSession(home, mkSession("a"));
    expect(deleteSession(home, "a")).toBe(true);
    expect(readSession(home, "a")).toBeNull();
  });

  it("returns false when the file does not exist", () => {
    const home = mkHome();
    expect(deleteSession(home, "ghost")).toBe(false);
  });
});
