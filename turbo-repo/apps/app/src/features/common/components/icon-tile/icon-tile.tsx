import type { IconType } from "react-icons";

/** Square tile behind a section-header icon, so it reads bigger without upsizing the glyph. */
export function IconTile({ icon: Icon }: { readonly icon: IconType }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
      <Icon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
    </div>
  );
}
