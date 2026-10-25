import type { ReactNode } from "react";

/**
 * The top of a rule sheet (symptom or communication rule): its header, with
 * the draft's actions in it. It is the first child of the page's scroll
 * container and spans its full width, so its bottom border does too; the
 * content is centred like the sheet.
 */
export default function SheetTop({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="sticky top-0 z-30 border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-3 px-4 py-3">
        {children}
      </div>
    </div>
  );
}
