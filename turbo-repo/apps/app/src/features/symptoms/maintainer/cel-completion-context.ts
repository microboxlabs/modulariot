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
  if (!quote) return text.length + 1;
  const delimiter = text.startsWith(quote.repeat(3), start)
    ? quote.repeat(3)
    : quote;
  const raw = text[start - 1]?.toLowerCase() === "r";
  let i = start + delimiter.length;
  while (i < text.length) {
    if (!raw && text[i] === "\\") i += 2;
    else if (text.startsWith(delimiter, i)) return i + delimiter.length;
    else i++;
  }
  return text.length + 1;
}

function commentEnd(text: string, start: number): number {
  const newline = text.indexOf("\n", start + 2);
  return newline < 0 ? text.length : newline;
}

/** Whether a position is CEL code, rather than part of a quoted literal or line comment. */
export function isCodePosition(text: string, pos: number): boolean {
  let i = 0;
  while (i <= pos && i < text.length) {
    const char = text[i];
    if (char === '"' || char === "'") {
      const end = quotedEnd(text, i);
      if (pos < end) return false;
      i = end;
    } else if (char === "/" && text[i + 1] === "/") {
      const end = commentEnd(text, i);
      if (pos < end) return false;
      i = end;
    } else {
      i++;
    }
  }
  return true;
}

/** Scan once, keeping strings and comments from binding macro variables. */
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
    } else if (char === "/" && text[i + 1] === "/") {
      i = commentEnd(text, i);
    } else {
      WORD.lastIndex = i;
      const word = WORD.exec(text);
      if (word) out.push({ text: word[0], quoted: false, closed: true });
      i = word ? WORD.lastIndex : i + 1;
    }
  }
  return out;
}

interface Scope {
  name?: string;
  previous?: string;
  receiver?: string;
  list?: string;
}

function macroScope(
  parts: Token[],
  i: number,
  previousReceiver: string | undefined,
  variables: Map<string, string>
): Scope {
  const call = parts[i - 1];
  if (!call || call.quoted) return {};
  const dot = call.text.lastIndexOf(".");
  const method = call.text.slice(dot + 1);
  if (!MACROS.has(method) || parts[i + 2]?.text !== ",") return {};
  const chained = parts[i - 2]?.text === "." && parts[i - 3]?.text === ")";
  const path = dot >= 0 ? call.text.slice(0, dot) : undefined;
  const receiver = path ?? (chained ? previousReceiver : undefined);
  const variable = parts[i + 1];
  if (!receiver || !variable || variable.quoted) return {};
  const list = resolved(receiver, variables);
  const name = variable.text;
  return {
    name,
    list,
    previous: variables.get(name),
    receiver: method === "filter" ? list : undefined,
  };
}

function restoreBinding(
  variables: Map<string, string>,
  scope: Scope | undefined
) {
  if (!scope?.name) return;
  if (scope.previous === undefined) variables.delete(scope.name);
  else variables.set(scope.name, scope.previous);
}

function bindings(parts: Token[]): Map<string, string> {
  const out = new Map<string, string>();
  const scopes: Scope[] = [];
  let receiver: string | undefined;
  for (let i = 0; i < parts.length; i++) {
    const token = parts[i];
    if (token?.quoted) continue;
    if (token?.text === "(") {
      const scope = macroScope(parts, i, receiver, out);
      scopes.push(scope);
      if (scope.name && scope.list) out.set(scope.name, scope.list);
    } else if (token?.text === ")") {
      const scope = scopes.pop();
      restoreBinding(out, scope);
      receiver = scope?.receiver;
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
  // CEL takes either quote; the value is escaped for the one in use.
  const quote = last?.text[0];
  const delimiterLength =
    quote && last?.text.startsWith(quote.repeat(3)) ? 3 : 1;
  const quoted =
    field && last && (quote === '"' || quote === "'")
      ? {
          path: resolved(field, variables),
          typed: last.text.slice(delimiterLength),
          quote: quote as '"' | "'",
        }
      : null;
  return { variables, quoted };
}
