import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { trDynamic } from "@/features/i18n/tr.service";
import type { CelProblem } from "./cel-editor";
import type { Finding } from "./maintainer-api";

const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A dictionary entry, or the fallback when the dictionary lacks it. */
function lookup(
  key: string,
  d: I18nRecord,
  fallback: string,
  params?: Record<string, string>
): string {
  const text = trDynamic(key, d, params);
  return text === key ? fallback : text;
}

/**
 * A finding in the user's language: its code as `finding<Code>`, with level
 * numbers and CEL types named. Without a known code, the server's Spanish text.
 */
export function findingText(f: Finding, d: I18nRecord): string {
  if (!f.code) return f.message;
  const params = Object.fromEntries(
    Object.entries(f.params ?? {}).map(([name, value]) => {
      if (name.startsWith("level"))
        return [name, lookup(`levelName${value}`, d, value)];
      if (name === "left" || name === "right")
        return [name, lookup(`ruleType${upperFirst(value)}`, d, value)];
      return [name, value];
    })
  );
  return lookup(`finding${upperFirst(f.code)}`, d, f.message, params);
}

/** The server's findings for one section, as editor problems. */
export function problemsFor(
  findings: Finding[] | undefined,
  section: string,
  d: I18nRecord
): CelProblem[] {
  return (findings ?? [])
    .filter((f) => f.section === section)
    .map((f) => findingProblem(f, d));
}

export function findingProblem(f: Finding, d: I18nRecord): CelProblem {
  return {
    position: Math.max(0, f.position),
    message: findingText(f, d),
    severity: f.severity === "ERROR" ? "error" : "warning",
  };
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
