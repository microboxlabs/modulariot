import type { ComponentType, SVGProps } from "react";
import { Code } from "flowbite-react-icons/outline";
import { Envelope, Whatsapp } from "flowbite-react-icons/solid";
import { twMerge } from "tailwind-merge";

type Logo = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * The logo per connection provider type, from Flowbite's icons as on the
 * sign-in page. Other types draw as code until templates name a brand (#2002).
 */
const KIND_LOGOS: Record<string, Logo> = {
  WHATSAPP: Whatsapp,
  RESEND: Envelope,
};

/** A connection kind's logo in a square; `size` is in Tailwind spacing units (5 = 20 px). */
export function KindIcon({
  kind,
  label,
  size = 6,
  className,
}: Readonly<{
  kind: string | null;
  label?: string;
  size?: number;
  className?: string;
}>) {
  const Logo = (kind && KIND_LOGOS[kind]) || Code;
  const px = size * 4;
  return (
    <span
      title={label}
      style={{ width: px, height: px }}
      className={twMerge(
        "inline-flex shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300",
        className
      )}
    >
      <Logo aria-hidden style={{ width: px * 0.6, height: px * 0.6 }} />
    </span>
  );
}
