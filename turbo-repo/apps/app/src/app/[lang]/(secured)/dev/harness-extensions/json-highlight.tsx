/**
 * Minimal, dependency-free JSON syntax highlighter - tokenizes each line
 * with a regex and wraps matches in colored spans. No dangerouslySetInnerHTML
 * (the content here is always our own generated JSON, but there's no reason
 * to reach for it when plain React nodes work just as well).
 */
const TOKEN_REGEX = /(".*?"(?=\s*:))|(".*?")|(\btrue\b|\bfalse\b)|(\bnull\b)|(-?\b\d+\.?\d*\b)/g;

function highlightLine(line: string, lineKey: number): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let tokenIndex = 0;
  let match: RegExpExecArray | null;

  TOKEN_REGEX.lastIndex = 0;
  while ((match = TOKEN_REGEX.exec(line))) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }
    const [full, propKey, str, bool, nul, num] = match;
    let className = "";
    if (propKey) className = "text-sky-700 dark:text-sky-400";
    else if (str) className = "text-emerald-700 dark:text-emerald-400";
    else if (bool) className = "text-purple-700 dark:text-purple-400";
    else if (nul) className = "text-gray-500 dark:text-gray-400";
    else if (num) className = "text-amber-700 dark:text-amber-400";
    parts.push(
      <span key={`${lineKey}-${tokenIndex++}`} className={className}>
        {full}
      </span>,
    );
    lastIndex = match.index + full.length;
  }
  parts.push(line.slice(lastIndex));
  return parts;
}

export function HighlightedJson({ json }: Readonly<{ json: string }>) {
  return (
    <>
      {json.split("\n").map((line, i) => (
        <div key={i}>{highlightLine(line, i)}</div>
      ))}
    </>
  );
}
