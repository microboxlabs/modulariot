interface Token {
  text: string;
  quoted: boolean;
  closed: boolean;
}

const MACROS = new Set(["exists", "exists_one", "all", "filter", "map"]);
// Sticky matching starts only at the current cursor, so long paths cannot cause retries at every character.
const WORD = /[A-Za-z_][\w.?]*|==|!=|\S/y;

function quotedEnd(text: string, start: number): number {
  const quote = text[start];
  let i = start + 1;
  while (i < text.length) {
    if (text[i] === "\\") i += 2;
    else if (text[i++] === quote) return i;
  }
  return text.length + 1;
}

/** Scan once, keeping strings opaque so a code example inside a string never binds a macro variable. */
function tokens(text: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (char === '"' || char === "'") {
      const end = quotedEnd(text, i);
      out.push({
        text: text.slice(i, end),
        quoted: true,
        closed: text[end - 1] === char && end <= text.length,
      });
      i = end;
    } else {
      WORD.lastIndex = i;
      const word = WORD.exec(text);
      if (word) out.push({ text: word[0], quoted: false, closed: true });
      i = word ? WORD.lastIndex : i + 1;
    }
  }
  return out;
}

function bindings(parts: Token[]): Map<string, string> {
  const out = new Map<string, string>();
  for (let i = 0; i + 3 < parts.length; i++) {
    const call = parts[i];
    if (!call || call.quoted) continue;
    const dot = call.text.lastIndexOf(".");
    if (dot < 0 || !MACROS.has(call.text.slice(dot + 1))) continue;
    if (parts[i + 1]?.text === "(" && parts[i + 3]?.text === ",") {
      out.set(
        parts[i + 2]?.text ?? "",
        call.text.slice(0, dot).replaceAll("?", "")
      );
    }
  }
  return out;
}

/** The list each macro variable walks: `signal.frame.events.exists(e, …` binds `e`. */
export function macroVariables(text: string): Map<string, string> {
  return bindings(tokens(text));
}

/** Write a macro variable's path as the list's path. */
export function resolved(path: string, variables: Map<string, string>): string {
  const plain = path.replaceAll("?", "");
  const [first = "", ...rest] = plain.split(".");
  const list = variables.get(first);
  return list ? [list, ...rest].join(".") : plain;
}

function comparedField(parts: Token[]): string | null {
  const operator = parts.at(-2)?.text;
  if (operator === "==" || operator === "!=") return parts.at(-3)?.text ?? null;
  // A list may contain only completed strings and commas before the current value.
  let i = parts.length - 2;
  while (i >= 0 && (parts[i]?.quoted || parts[i]?.text === ",")) i--;
  if (parts[i]?.text !== "[" || parts[i - 1]?.text !== "in") return null;
  return parts[i - 2]?.text ?? null;
}

/** Completion context for an unfinished text comparison or membership list. */
export function completionContext(text: string) {
  const parts = tokens(text);
  const variables = bindings(parts);
  const last = parts.at(-1);
  const field = last?.quoted && !last.closed ? comparedField(parts) : null;
  const quoted =
    field && last?.text.startsWith('"')
      ? { path: resolved(field, variables), typed: last.text.slice(1) }
      : null;
  return { variables, quoted };
}
