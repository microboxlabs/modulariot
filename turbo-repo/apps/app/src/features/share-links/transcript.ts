import type { SharedMessage } from "./share-links-api";

/** The only stored message shape this reader knows; matches the chat's
 * AUI_MESSAGE_FORMAT. */
const SUPPORTED_FORMAT = "aui-v1";

export type TranscriptPart =
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "tool";
      readonly id: string;
      readonly name: string;
      readonly title: string | null;
      readonly args: Record<string, unknown>;
      readonly result: unknown;
      readonly isError: boolean;
    }
  | { readonly kind: "attachment"; readonly name: string };

export interface TranscriptEntry {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly parts: readonly TranscriptPart[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toolTitle(args: unknown): string | null {
  if (!isRecord(args)) return null;
  for (const key of ["title", "name", "label"]) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function toPart(raw: unknown): TranscriptPart | null {
  if (!isRecord(raw)) return null;
  if (raw.type === "text" && typeof raw.text === "string" && raw.text.trim()) {
    return { kind: "text", text: raw.text };
  }
  if (raw.type === "tool-call" && typeof raw.toolName === "string") {
    return {
      kind: "tool",
      id: typeof raw.toolCallId === "string" ? raw.toolCallId : "",
      name: raw.toolName,
      title: toolTitle(raw.args),
      args: isRecord(raw.args) ? raw.args : {},
      result: raw.result,
      isError: raw.isError === true,
    };
  }
  return null;
}

function attachmentParts(raw: unknown): TranscriptPart[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((a): TranscriptPart[] =>
    isRecord(a) && typeof a.name === "string"
      ? [{ kind: "attachment", name: a.name }]
      : []
  );
}

/**
 * The messages on the thread's current branch, oldest first. A retried or
 * edited turn is stored as a sibling of the attempt it replaces (same
 * parent), so reading every row in append order would show both; the chat
 * shows the branch that ends at the newest message, and so does this.
 * Threads stored without parent links are read in append order.
 */
function currentBranch(sorted: readonly SharedMessage[]): SharedMessage[] {
  if (!sorted.some((m) => m.parentId !== null)) return [...sorted];
  const byId = new Map(sorted.map((m) => [m.id, m]));
  const branch: SharedMessage[] = [];
  const seen = new Set<string>();
  let current = sorted.at(-1);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    branch.push(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return branch.reverse();
}

/**
 * The user and assistant turns of a stored thread's current branch, reduced
 * to what a reader can show without the chat runtime: text, the tool calls
 * the assistant made (with their args, for the cards), and attachment names.
 * Messages in an unknown format, other roles and empty turns are left out.
 */
export function toTranscript(
  messages: readonly SharedMessage[]
): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  const sorted = [...messages].sort((a, b) => a.seq - b.seq);
  for (const message of currentBranch(sorted)) {
    if (message.format !== SUPPORTED_FORMAT) continue;
    const { role, content, attachments } = message.payload;
    if (role !== "user" && role !== "assistant") continue;
    const parts = [
      ...attachmentParts(attachments),
      ...(Array.isArray(content) ? content : [])
        .map(toPart)
        .filter((part): part is TranscriptPart => part !== null),
    ];
    if (parts.length > 0) entries.push({ id: message.id, role, parts });
  }
  return entries;
}
