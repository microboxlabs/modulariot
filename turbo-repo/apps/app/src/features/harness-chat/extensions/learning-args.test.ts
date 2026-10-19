import { describe, expect, it } from "vitest";
import {
  changeKey,
  knowledgeChangesOf,
  refOfPath,
  virtualPath,
} from "./knowledge-change-args";
import { caseTrend, learningEvalArgsOf } from "./learning-eval-args";

describe("virtual paths", () => {
  it("map each layer to the file tools' path and back", () => {
    const cases: [string, string, string | null, string][] = [
      ["rule", "loaded", null, "rules/loaded.md"],
      ["skill", "count-trips", null, "skills/count-trips/SKILL.md"],
      ["fact", "states", "trips", "facts/trips/states.md"],
      ["primer", "trips", null, "primers/trips.md"],
      ["eval", "today", null, "evals/today.yaml"],
      ["note", "n1", "trips", "notes/trips/n1.md"],
    ];
    for (const [layer, id, target, path] of cases) {
      expect(virtualPath(layer, id, target)).toBe(path);
      expect(refOfPath(path)).toEqual({ layer, id, target });
    }
  });

  it("names nothing for base views or unknown paths", () => {
    expect(refOfPath("base/skills/x/SKILL.md")).toBeNull();
    expect(refOfPath("rules/nested/x.md")).toBeNull();
    expect(refOfPath("skills/x/README.md")).toBeNull();
    expect(virtualPath("fact", "x", null)).toBeNull();
  });
});

describe("knowledgeChangesOf", () => {
  const diff = "--- a/rules/x.md\n+++ b/rules/x.md\n@@ -1 +1 @@\n-a\n+b\n";

  it("reads a file tool's path, layer and diff, keeping the diff's whitespace", () => {
    const [change] = knowledgeChangesOf("ws_edit", {
      path: "rules/x.md",
      layer: "rule",
      diff,
    });
    expect(change).toMatchObject({
      path: "rules/x.md",
      layer: "rule",
      id: "x",
      op: "edit",
      diff,
    });
  });

  it("reads each change of a proposal and names its path", () => {
    const changes = knowledgeChangesOf("propose_knowledge_change", {
      summary: "s",
      changes: [
        {
          layer: "fact",
          id: "states",
          target: "trips",
          op: "upsert",
          content: "c",
        },
        { layer: "rule", id: "old", op: "delete" },
      ],
    });
    expect(changes.map((c) => c.path)).toEqual([
      "facts/trips/states.md",
      "rules/old.md",
    ]);
    expect(changes[1].op).toBe("delete");
  });

  it("reads a proposal's result under the names the harness may use", () => {
    expect(
      knowledgeChangesOf("propose_knowledge_change", {
        applied: [{ layer: "rule", id: "x", new_version: 3 }],
      })[0].version
    ).toBe(3);
  });

  it("shows scratchpad writes only when they carry a diff", () => {
    expect(knowledgeChangesOf("fs_write", { path: "a.md" })).toEqual([]);
    expect(knowledgeChangesOf("fs_write", { path: "a.md", diff })[0].op).toBe(
      "write"
    );
  });

  it("ignores other tools and other values", () => {
    expect(knowledgeChangesOf("sql_query", { diff })).toEqual([]);
    expect(knowledgeChangesOf("ws_edit", "text")).toEqual([]);
  });

  it("keys a change by its item, version and operation", () => {
    const [a] = knowledgeChangesOf("ws_edit", {
      path: "rules/x.md",
      diff,
      version: 2,
    });
    const [b] = knowledgeChangesOf("ws_edit", {
      path: "rules/x.md",
      diff,
      version: 3,
    });
    expect(changeKey(a)).not.toBe(changeKey(b));
  });
});

describe("learningEvalArgsOf", () => {
  it("reads the evaluation id, status and summary", () => {
    expect(
      learningEvalArgsOf({
        evaluation_id: "ev1",
        status: "done",
        model: "m",
        summary: {
          baseline_avg: 1,
          candidate_avg: 2,
          improved: 1,
          regressed: 0,
          unchanged: 3,
        },
      })
    ).toEqual({
      evaluationId: "ev1",
      status: "done",
      model: "m",
      summary: {
        baseline_avg: 1,
        candidate_avg: 2,
        improved: 1,
        regressed: 0,
        unchanged: 3,
      },
    });
  });

  it("reads an evaluation nested in the result", () => {
    expect(
      learningEvalArgsOf({ evaluation: { id: "ev2" } })?.evaluationId
    ).toBe("ev2");
  });

  it("is null for a result that names nothing", () => {
    expect(learningEvalArgsOf({ ok: true })).toBeNull();
    expect(learningEvalArgsOf(null)).toBeNull();
  });

  it("tells how a case moved", () => {
    const run = (score: number | null) => ({ answer: "", score, reason: "" });
    const c = { question: "q", expectation: "e" };
    expect(caseTrend({ case: c, baseline: run(1), candidate: run(3) })).toBe(
      "improved"
    );
    expect(caseTrend({ case: c, baseline: run(3), candidate: run(1) })).toBe(
      "regressed"
    );
    expect(caseTrend({ case: c, baseline: run(2), candidate: run(2) })).toBe(
      "unchanged"
    );
    expect(caseTrend({ case: c, baseline: run(null), candidate: run(2) })).toBe(
      "unknown"
    );
  });
});
