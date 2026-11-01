import { Fragment, type ReactNode } from "react";
import { fillText } from "./rule-model";

/** A run of WhatsApp text: plain, or wrapped in one of its format marks. */
export type FormatPart =
  | { kind: "text"; text: string }
  | {
      kind: "bold" | "italic" | "strike" | "mono";
      parts: FormatPart[];
    };

const MARKS: Record<string, "bold" | "italic" | "strike"> = {
  "*": "bold",
  _: "italic",
  "~": "strike",
};

const isWordChar = (c: string | undefined) =>
  c !== undefined && /[\p{L}\p{N}]/u.test(c);
const isSpace = (c: string | undefined) => c !== undefined && /\s/.test(c);

/**
 * Where the mark opened at `start` closes on the same line, or -1. Like WhatsApp: the mark opens and closes
 * outside a word, and the text inside neither starts nor ends with a space.
 */
function closingMark(text: string, start: number): number {
  const mark = text[start];
  if (isWordChar(text[start - 1]) || isSpace(text[start + 1])) return -1;
  const newline = text.indexOf("\n", start + 1);
  const lineEnd = newline === -1 ? text.length : newline;
  let end = text.indexOf(mark, start + 2);
  while (end !== -1 && end < lineEnd) {
    if (!isSpace(text[end - 1]) && !isWordChar(text[end + 1])) return end;
    end = text.indexOf(mark, end + 1);
  }
  return -1;
}

/** WhatsApp's formatting: `*bold*`, `_italic_`, `~strike~` and ```` ```mono``` ````, nested. */
export function parseWhatsApp(text: string): FormatPart[] {
  const out: FormatPart[] = [];
  let plain = "";
  const flush = () => {
    if (plain) out.push({ kind: "text", text: plain });
    plain = "";
  };
  let i = 0;
  while (i < text.length) {
    const mono = text.startsWith("```", i) ? text.indexOf("```", i + 3) : -1;
    if (mono > i + 3) {
      flush();
      out.push({
        kind: "mono",
        parts: [{ kind: "text", text: text.slice(i + 3, mono) }],
      });
      i = mono + 3;
      continue;
    }
    const kind = MARKS[text[i]];
    const end = kind ? closingMark(text, i) : -1;
    if (kind && end !== -1) {
      flush();
      out.push({ kind, parts: parseWhatsApp(text.slice(i + 1, end)) });
      i = end + 1;
      continue;
    }
    plain += text[i];
    i++;
  }
  flush();
  return out;
}

function unformatted(parts: FormatPart[]): string {
  return parts
    .map((p) => (p.kind === "text" ? p.text : unformatted(p.parts)))
    .join("");
}

/** The text without WhatsApp's format marks, for channels that would show them as typed. */
export function plainText(text: string): string {
  return unformatted(parseWhatsApp(text));
}

/** The text cut around its `{{name}}` placeholders, each piece with its offset in the text. */
function placeholderPieces(text: string): { at: number; piece: string }[] {
  const out: { at: number; piece: string }[] = [];
  let at = 0;
  for (const piece of text.split(/(\{\{[\w.]+\}\})/g)) {
    if (piece) out.push({ at, piece });
    at += piece.length;
  }
  return out;
}

/** `{{name}}` left in a filled text: a variable without a value. */
function Placeholders({ text }: Readonly<{ text: string }>) {
  return (
    <>
      {placeholderPieces(text).map(({ at, piece }) =>
        /^\{\{[\w.]+\}\}$/.test(piece) ? (
          <span
            key={at}
            className="rounded bg-amber-100 px-1 font-mono text-[0.85em] text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
          >
            {piece}
          </span>
        ) : (
          <Fragment key={at}>{piece}</Fragment>
        )
      )}
    </>
  );
}

function Parts({ parts }: Readonly<{ parts: FormatPart[] }>): ReactNode {
  return parts.map((p, i) => {
    const k = i;
    if (p.kind === "text") return <Placeholders key={k} text={p.text} />;
    const inner = <Parts parts={p.parts} />;
    if (p.kind === "bold") return <strong key={k}>{inner}</strong>;
    if (p.kind === "italic") return <em key={k}>{inner}</em>;
    if (p.kind === "strike") return <s key={k}>{inner}</s>;
    return (
      <code key={k} className="font-mono text-[0.92em]">
        {inner}
      </code>
    );
  });
}

/** The text with the values in place of its variables. Variables without one stay as `{{name}}`. */
export function filled(text: string, values: Record<string, string>): string {
  return fillText(text, values)
    .map((p) => {
      if ("text" in p) return p.text;
      return p.value === null || p.value === "" ? `{{${p.variable}}}` : p.value;
    })
    .join("");
}

/** A text as WhatsApp shows it: values filled in, then its formatting applied. */
export default function WhatsAppText({
  text,
  values,
  format = true,
}: Readonly<{
  text: string;
  values: Record<string, string>;
  /** False for channels that show the marks as typed. */
  format?: boolean;
}>) {
  const out = filled(text, values);
  return format ? (
    <Parts parts={parseWhatsApp(out)} />
  ) : (
    <Placeholders text={out} />
  );
}
