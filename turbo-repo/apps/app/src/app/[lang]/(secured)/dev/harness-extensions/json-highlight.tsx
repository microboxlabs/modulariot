/**
 * Minimal, dependency-free JSON syntax highlighter - hand-scans each line
 * character by character and wraps recognized tokens in colored spans. No
 * dangerouslySetInnerHTML (the content here is always our own generated
 * JSON, but there's no reason to reach for it when plain React nodes work
 * just as well).
 *
 * Deliberately not a regex. Every shape tried for the "quoted string with
 * escapes" token — a lazy `.*?`, then the "unrolled loop"
 * `[^"\\]*(?:\\.[^"\\]*)*` — still got flagged by static analysis for
 * complexity and/or backtracking safety. A variable-length, escape-aware
 * token is exactly what those checks can't easily prove safe no matter how
 * it's phrased as a single pattern, so this scans it by hand instead: no
 * regex engine involved means no backtracking question to answer.
 */

const KEYWORDS = ["true", "false", "null"] as const;

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= "0" && ch <= "9";
}

function isWordChar(ch: string | undefined): boolean {
  return (
    ch !== undefined &&
    (isDigit(ch) || (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_")
  );
}

/** Index just past the closing quote of the JSON string starting at `start`
 * (which must be the opening quote). Falls back to the end of the line for
 * an unterminated string — this only ever renders content we generated, but
 * there's no reason a stray quote should be able to hang the highlighter. */
function scanString(line: string, start: number): number {
  let i = start + 1;
  while (i < line.length) {
    if (line[i] === "\\") {
      i += 2;
      continue;
    }
    if (line[i] === '"') return i + 1;
    i++;
  }
  return line.length;
}

/** Index just past a JSON number (`-?\d+(\.\d+)?`) starting at `start`, or
 * `start` itself if there's no digit there at all. */
function scanNumber(line: string, start: number): number {
  let i = line[start] === "-" ? start + 1 : start;
  const digitsStart = i;
  while (isDigit(line[i])) i++;
  if (i === digitsStart) return start;
  if (line[i] === "." && isDigit(line[i + 1])) {
    i++;
    while (isDigit(line[i])) i++;
  }
  return i;
}

/** Matches a whole `true`/`false`/`null` keyword at `start` — checks the
 * surrounding characters aren't word characters too, same as `\bkeyword\b`
 * would, so e.g. `"truest"` doesn't get "true" highlighted inside it. */
function matchKeyword(line: string, start: number): string | null {
  if (isWordChar(line[start - 1])) return null;
  for (const keyword of KEYWORDS) {
    const end = start + keyword.length;
    if (line.startsWith(keyword, start) && !isWordChar(line[end])) return keyword;
  }
  return null;
}

function isFollowedByColon(line: string, index: number): boolean {
  let i = index;
  while (line[i] === " " || line[i] === "\t") i++;
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
  let plainStart = 0;
  let tokenIndex = 0;
  let i = 0;

  const pushToken = (token: string, end: number, isPropertyKey = false) => {
    if (i > plainStart) parts.push(line.slice(plainStart, i));
    parts.push(
      <span key={`${lineKey}-${tokenIndex++}`} className={classNameForToken(token, isPropertyKey)}>
        {token}
      </span>,
    );
    plainStart = end;
    i = end;
  };

  while (i < line.length) {
    if (line[i] === '"') {
      const end = scanString(line, i);
      pushToken(line.slice(i, end), end, isFollowedByColon(line, end));
      continue;
    }
    const keyword = matchKeyword(line, i);
    if (keyword) {
      pushToken(keyword, i + keyword.length);
      continue;
    }
    const numberEnd = scanNumber(line, i);
    if (numberEnd > i) {
      pushToken(line.slice(i, numberEnd), numberEnd);
      continue;
    }
    i++;
  }
  if (line.length > plainStart) parts.push(line.slice(plainStart));
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
