/**
 * Minimal, dependency-free JSON syntax highlighter - tokenizes each line
 * with a regex and wraps matches in colored spans. No dangerouslySetInnerHTML
 * (the content here is always our own generated JSON, but there's no reason
 * to reach for it when plain React nodes work just as well).
 *
 * Matches a single JSON string OR a bare true/false/null/number literal.
 * Whether a matched string is a property key (vs. a value) isn't decided in
 * the regex itself — a lookahead there would've meant two near-duplicate
 * string alternatives (one with, one without), which is exactly what made
 * the old pattern both over the regex-complexity budget and prone to
 * non-linear backtracking (`.*?` has no way to tell the two apart without
 * retrying). key-vs-value is classified afterward in plain code instead.
 *
 * The string branch is the "unrolled loop" form
 * (`[^"\\]*(?:\\.[^"\\]*)*`) rather than `(?:[^"\\]|\\.)*` — both match the
 * same strings (there's only one way to parse any given input either way,
 * so neither is actually ambiguous), but a star wrapped directly around an
 * alternation is exactly the shape static backtracking-safety checks key
 * off of. Splitting the "run of plain chars" and "escape pair" into two
 * separately-starred, non-alternating pieces says the same thing in a shape
 * that doesn't trip that heuristic.
 */
const TOKEN_REGEX = /"[^"\\]*(?:\\.[^"\\]*)*"|\btrue\b|\bfalse\b|\bnull\b|-?\b\d+\.?\d*\b/g;

function isFollowedByColon(line: string, index: number): boolean {
  let i = index;
  while (i < line.length && /\s/.test(line[i])) i++;
  return line[i] === ":";
}

function classNameForToken(token: string, isPropertyKey: boolean): string {
  if (isPropertyKey) return "text-sky-700 dark:text-sky-400";
  if (token.startsWith('"')) return "text-emerald-700 dark:text-emerald-400";
  if (token === "true" || token === "false") return "text-purple-700 dark:text-purple-400";
  if (token === "null") return "text-gray-500 dark:text-gray-400";
  return "text-amber-700 dark:text-amber-400";
}

function highlightLine(line: string, lineKey: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let tokenIndex = 0;
  let match: RegExpExecArray | null;

  TOKEN_REGEX.lastIndex = 0;
  while ((match = TOKEN_REGEX.exec(line))) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }
    const [token] = match;
    const isPropertyKey = token.startsWith('"') && isFollowedByColon(line, match.index + token.length);
    parts.push(
      <span key={`${lineKey}-${tokenIndex++}`} className={classNameForToken(token, isPropertyKey)}>
        {token}
      </span>,
    );
    lastIndex = match.index + token.length;
  }
  parts.push(line.slice(lastIndex));
  return parts;
}

export function HighlightedJson({ json }: Readonly<{ json: string }>) {
  const seen = new Map<string, number>();
  return (
    <>
      {json.split("\n").map((line) => {
        // Content-derived key, not the array index — the rendered lines
        // never reorder/insert/remove independently (the whole `json` string
        // is always replaced as one unit), but duplicate lines are common in
        // JSON (e.g. repeated "},"), so an occurrence count disambiguates.
        const occurrence = seen.get(line) ?? 0;
        seen.set(line, occurrence + 1);
        const lineKey = `${line}#${occurrence}`;
        return <div key={lineKey}>{highlightLine(line, lineKey)}</div>;
      })}
    </>
  );
}
