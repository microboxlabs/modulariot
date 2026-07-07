import { SEV } from "./vital-signs-data";

export default function SeverityLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 w-fit rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
      {SEV.map((sev) => (
        <div key={sev.code} className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: sev.color }}
          />
          {sev.en}
        </div>
      ))}
    </div>
  );
}
