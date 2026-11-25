import type { ComponentType, SVGProps } from "react";
import { twMerge } from "tailwind-merge";

/**
 * The icon beside a page or section title that has a description under it.
 *
 * A 48px tile is about as tall as that two-line block (a 32px title line and
 * a 20px description line), so centring it on the block looks intentional;
 * the icon inside is half the tile. Next to a single line of text, size the
 * icon to that line instead and leave the tile out.
 */
export default function HeaderIconTile({
  icon: Icon,
  iconClassName,
}: Readonly<{
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** For an icon with a colour of its own, such as a brand's. */
  iconClassName?: string;
}>) {
  return (
    <span
      aria-hidden
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-200"
    >
      <Icon className={twMerge("h-6 w-6", iconClassName)} />
    </span>
  );
}
