import MarkdownTooltip from "./markdown-tooltip";
import { SEV } from "./vital-signs-data";

function buildTooltipMarkdown(ceiling: number): string {
  const reachable = SEV.filter((sev) => sev.code <= ceiling);

  return [
    "This vital sign is configured to have the next states:",
    "",
    ...reachable.map((sev) => `- ${sev.en}`),
  ].join("\n");
}

export default function SeverityDots({
  ceiling,
}: Readonly<{ ceiling: number }>) {
  return (
    <MarkdownTooltip content={buildTooltipMarkdown(ceiling)}>
      <div className="flex items-center gap-1 shrink-0">
        {SEV.map((sev) => (
          <span
            key={sev.code}
            className={`w-2.5 h-2.5 rounded-full border ${
              sev.code > ceiling ? "border-gray-300 dark:border-gray-600" : ""
            }`}
            style={
              sev.code <= ceiling
                ? { backgroundColor: sev.color, borderColor: sev.color }
                : undefined
            }
          />
        ))}
      </div>
    </MarkdownTooltip>
  );
}
