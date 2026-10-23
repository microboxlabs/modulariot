import type { ComponentType, SVGProps } from "react";
import { Code } from "flowbite-react-icons/outline";
import { Envelope, Whatsapp } from "flowbite-react-icons/solid";
import { PiMicrosoftTeamsLogoFill } from "react-icons/pi";
import { SiSlack } from "react-icons/si";
import { twMerge } from "tailwind-merge";

type Logo = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * The logo per channel type in the text colour. Flowbite's icons where it has
 * them, as on the sign-in page; Teams and Slack from react-icons. Other types
 * draw as code.
 */
const CHANNEL_LOGOS: Record<string, Logo> = {
  email: Envelope,
  whatsapp: Whatsapp,
  teams: PiMicrosoftTeamsLogoFill,
  slack: SiSlack,
};

/** A channel type's logo in a square; `size` is in Tailwind spacing units (5 = 20 px). */
export function ChannelIcon({
  channel,
  label,
  size = 6,
  className,
}: Readonly<{
  channel: string | null;
  label?: string;
  size?: number;
  className?: string;
}>) {
  const Logo = (channel && CHANNEL_LOGOS[channel]) || Code;
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
