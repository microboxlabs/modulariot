import { memo, type ReactNode } from "react";

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400">
      {children}
    </kbd>
  );
}

function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((k) => <Key key={k}>{k}</Key>)}
      <span>{label}</span>
    </span>
  );
}

export const SpotlightFooter = memo(function SpotlightFooter({
  hasResults,
}: { hasResults: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400 dark:border-gray-700 dark:text-gray-500 select-none">
      {hasResults && (
        <>
          <Hint keys={["↑", "↓"]} label="Navigate" />
          <Hint keys={["↵"]} label="Open" />
        </>
      )}
      <span className="ml-auto">
        <Hint keys={["Esc"]} label="Close" />
      </span>
    </div>
  );
});
