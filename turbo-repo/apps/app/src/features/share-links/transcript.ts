import type { SharedMessage } from "./share-links-api";

/** The only stored message shape this reader knows; matches the chat's
 * AUI_MESSAGE_FORMAT. */
const SUPPORTED_FORMAT = "aui-v1";

export type TranscriptPart =
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "tool";
      readonly name: string;
      readonly title: string | null;
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
    return { kind: "tool", name: raw.toolName, title: toolTitle(raw.args) };
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
 * The user and assistant turns of a stored thread, in the order they were
 * appended, reduced to what a reader can show without the chat runtime:
 * text, the tools the assistant used, and attachment names. Messages in an
 * unknown format, other roles and empty turns are left out.
 */
export function toTranscript(
  messages: readonly SharedMessage[]
): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  for (const message of [...messages].sort((a, b) => a.seq - b.seq)) {
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
