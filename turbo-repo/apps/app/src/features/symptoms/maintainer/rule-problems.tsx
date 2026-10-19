import type { CelProblem } from "./cel-editor";
import type { Finding } from "./maintainer-api";

/** The server's findings for one section, as editor problems. */
export function problemsFor(
  findings: Finding[] | undefined,
  section: string
): CelProblem[] {
  return (findings ?? [])
    .filter((f) => f.section === section)
    .map((f) => ({
      position: Math.max(0, f.position),
      message: f.message,
      severity: f.severity === "ERROR" ? "error" : "warning",
    }));
}

export function Problems({ items }: Readonly<{ items: CelProblem[] }>) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((p) => (
        <li
          key={`${p.position}-${p.message}`}
          className={`text-xs ${p.severity === "error" ? "text-red-600 dark:text-red-400" : "text-yellow-700 dark:text-yellow-400"}`}
        >
          {p.message}
        </li>
      ))}
    </ul>
  );
}
