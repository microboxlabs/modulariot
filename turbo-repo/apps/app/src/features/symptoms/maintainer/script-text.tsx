import type { FilledPart } from "./script-fill";

/** A filled script; each field the case lacks shows as its name in brackets, in amber, for the operator to say. */
export default function ScriptText({
  parts,
  title,
}: Readonly<{ parts: readonly FilledPart[]; title?: string }>) {
  return (
    <>
      {parts.map((part, i) => {
        const key = `part-${i}`;
        if ("text" in part) return <span key={key}>{part.text}</span>;
        return (
          <span
            key={key}
            title={title}
            data-blank=""
            className="font-medium text-amber-700 dark:text-amber-400"
          >
            {part.blank}
          </span>
        );
      })}
    </>
  );
}
