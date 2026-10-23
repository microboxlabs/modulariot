import type { ComponentType, SVGProps } from "react";
import { Bell, Code } from "flowbite-react-icons/outline";
import { Envelope, Whatsapp } from "flowbite-react-icons/solid";
import { twMerge } from "tailwind-merge";

type Logo = ComponentType<SVGProps<SVGSVGElement>>;

/** Flowbite's logos, as on the sign-in page; "preferred" is a bell, anything else code. */
const LOGOS: Record<string, Logo> = {
  whatsapp: Whatsapp,
  email: Envelope,
  preferred: Bell,
};

/** A channel's logo in a bordered square, in the text colour; `size` is in Tailwind units (6 = 24 px). */
export default function ChannelIcon({
  channel,
  label,
  size = 6,
  className,
}: Readonly<{
  channel: string | null | undefined;
  label?: string;
  size?: number;
  className?: string;
}>) {
  const Icon = (channel && LOGOS[channel]) || Code;
  const px = size * 4;
  return (
    <span
      title={label}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-channel={channel ?? ""}
      style={{ width: px, height: px }}
      className={twMerge(
        "inline-flex shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300",
        className
      )}
    >
      <Icon aria-hidden style={{ width: px * 0.6, height: px * 0.6 }} />
    </span>
  );
}
