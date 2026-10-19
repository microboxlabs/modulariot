/**
 * Knowledge changes as the harness's trainer tools describe them: in an
 * approval request (what will change) and in a tool result (what changed).
 * Shared by the relay, which turns tool results into cards, and the cards.
 */

export const SHOW_KNOWLEDGE_CHANGE_TOOL = "show_knowledge_change";

export const PROPOSE_KNOWLEDGE_CHANGE_TOOL = "propose_knowledge_change";
export const WORKSPACE_WRITE_TOOLS = [
  "ws_write",
  "ws_edit",
  "ws_delete",
] as const;
/** The chat's in-memory scratchpad; its results carry a `diff` too. */
export const SCRATCHPAD_WRITE_TOOLS = ["fs_write", "fs_edit"] as const;

export type KnowledgeChange = {
  /** The file tools' path, e.g. `rules/<id>.md`. */
  path: string | null;
  layer: string | null;
  id: string | null;
  target: string | null;
  /** `upsert`/`delete` for a change, or the file tool's own verb. */
  op: string | null;
  /** Unified diff; null when the payload has none. */
  diff: string | null;
  title: string | null;
  /** The new text, for a change that carries it instead of a diff. */
  content: string | null;
  reason: string | null;
  version: number | null;
};

export type ShowKnowledgeChangeArgs = {
  tool: string;
  changes: KnowledgeChange[];
  summary?: string;
  /** Part of the result was cut before it reached the app. */
  truncated?: boolean;
};

const DEFAULT_OPS: Record<string, string> = {
  ws_write: "write",
  ws_edit: "edit",
  ws_delete: "delete",
  fs_write: "write",
  fs_edit: "edit",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Diffs keep their whitespace. */
function raw(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function int(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

/** The file tools' path of a knowledge item; the harness uses the same map. */
export function virtualPath(
  layer: string,
  id: string,
  target: string | null = null
): string | null {
  switch (layer) {
    case "rule":
      return `rules/${id}.md`;
    case "skill":
      return `skills/${id}/SKILL.md`;
    case "fact":
      return target ? `facts/${target}/${id}.md` : null;
    case "primer":
      return `primers/${id}.md`;
    case "eval":
      return `evals/${id}.yaml`;
    case "note":
      return target ? `notes/${target}/${id}.md` : null;
    default:
      return null;
  }
}

export type KnowledgeRef = { layer: string; id: string; target: string | null };

function stem(name: string, suffix: string): string | null {
  return name.endsWith(suffix) && name.length > suffix.length
    ? name.slice(0, -suffix.length)
    : null;
}

/** The item a file tools' path names; null for `base/...` and anything else. */
export function refOfPath(path: string): KnowledgeRef | null {
  const parts = path.split("/").filter((p) => p && p !== ".");
  const [head, a, b] = parts;
  let ref: KnowledgeRef | null = null;
  if (parts.length === 2) {
    if (head === "rules") ref = withId("rule", stem(a, ".md"), null);
    else if (head === "primers") ref = withId("primer", stem(a, ".md"), null);
    else if (head === "evals") ref = withId("eval", stem(a, ".yaml"), null);
  } else if (parts.length === 3) {
    if (head === "skills" && b === "SKILL.md") ref = withId("skill", a, null);
    else if (head === "facts") ref = withId("fact", stem(b, ".md"), a);
    else if (head === "notes") ref = withId("note", stem(b, ".md"), a);
  }
  return ref;
}

function withId(
  layer: string,
  id: string | null,
  target: string | null
): KnowledgeRef | null {
  return id ? { layer, id, target } : null;
}

function changeOf(
  value: Record<string, unknown>,
  defaultOp: string | null
): KnowledgeChange {
  const path = str(value.path);
  const fromPath = path ? refOfPath(path) : null;
  const layer = str(value.layer) ?? fromPath?.layer ?? null;
  const id = str(value.id) ?? fromPath?.id ?? null;
  const target = str(value.target) ?? fromPath?.target ?? null;
  return {
    path: path ?? (layer && id ? virtualPath(layer, id, target) : null),
    layer,
    id,
    target,
    op: str(value.op) ?? defaultOp,
    diff: raw(value.diff),
    title: str(value.title),
    content: typeof value.content === "string" ? value.content : null,
    reason: str(value.reason),
    version: int(value.version) ?? int(value.new_version),
  };
}

const LIST_KEYS = ["changes", "applied", "results", "items"] as const;

/**
 * The changes a trainer tool's approval input or result describes: one for a
 * file tool, one per entry for `propose_knowledge_change`. Empty for any
 * other tool, and for a scratchpad write that carries no diff.
 */
export function knowledgeChangesOf(
  tool: string,
  value: unknown
): KnowledgeChange[] {
  if (!isRecord(value)) return [];
  if (tool === PROPOSE_KNOWLEDGE_CHANGE_TOOL) {
    const list = LIST_KEYS.map((key) => value[key]).find(Array.isArray);
    if (list) {
      return list
        .filter(isRecord)
        .map((entry) => changeOf(entry, null))
        .filter((c) => c.path || c.diff || c.id);
    }
    const single = changeOf(value, null);
    return single.path || single.diff ? [single] : [];
  }
  if ((WORKSPACE_WRITE_TOOLS as readonly string[]).includes(tool)) {
    const change = changeOf(value, DEFAULT_OPS[tool]);
    return change.path || change.diff ? [change] : [];
  }
  if ((SCRATCHPAD_WRITE_TOOLS as readonly string[]).includes(tool)) {
    const change = changeOf(value, DEFAULT_OPS[tool]);
    return change.diff ? [change] : [];
  }
  return [];
}

/** A stable key for a change, to tell repeats apart. */
export function changeKey(change: KnowledgeChange): string {
  return [
    change.path ?? `${change.layer}/${change.target ?? ""}/${change.id}`,
    change.version ?? "",
    change.op ?? "",
  ].join("|");
}

/** Added and removed line counts of a unified diff. */
export function diffStats(diff: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) added++;
    else if (line.startsWith("-")) removed++;
  }
  return { added, removed };
}
