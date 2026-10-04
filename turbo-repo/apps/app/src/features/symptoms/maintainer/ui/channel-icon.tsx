import type { ReactNode } from "react";

interface ChannelStyle {
  bg: string;
  glyph: ReactNode;
}

const STROKE = { fill: "none", stroke: "#fff" } as const;

/** Colour and glyph per notice channel; unknown channels draw as webhook. */
export const CHANNEL_STYLES: Record<string, ChannelStyle> = {
  teams: {
    bg: "#5059C9",
    glyph: (
      <path
        d="M7 7h10M12 7v10"
        {...STROKE}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    ),
  },
  whatsapp: {
    bg: "#25D366",
    glyph: (
      <>
        <path
          d="M12 4.5a7.5 7.5 0 0 0-6.5 11.2L4.5 19.5l3.9-1a7.5 7.5 0 1 0 3.6-14Z"
          {...STROKE}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M9.3 9.2c.2 2.3 2.2 4.4 4.6 4.8"
          {...STROKE}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </>
    ),
  },
  email: {
    bg: "#0284c7",
    glyph: (
      <>
        <rect
          x="4.5"
          y="6.5"
          width="15"
          height="11"
          rx="1.5"
          {...STROKE}
          strokeWidth="1.8"
        />
        <path
          d="m5 7.5 7 5 7-5"
          {...STROKE}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  app: {
    bg: "#f97316",
    glyph: (
      <>
        <rect
          x="8"
          y="4"
          width="8"
          height="16"
          rx="2"
          {...STROKE}
          strokeWidth="1.8"
        />
        <path
          d="M11 17h2"
          {...STROKE}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </>
    ),
  },
  webhook: {
    bg: "#374151",
    glyph: (
      <path
        d="m9 8-4 4 4 4M15 8l4 4-4 4"
        {...STROKE}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
};

/** A channel's square icon; `size` is in Tailwind spacing units (5 = 20 px). */
export function ChannelIcon({
  channel,
  label,
  size = 6,
}: Readonly<{ channel: string; label?: string; size?: number }>) {
  const style = CHANNEL_STYLES[channel] ?? CHANNEL_STYLES.webhook;
  const px = size * 4;
  return (
    <span
      title={label}
      style={{ background: style.bg, width: px, height: px }}
      className="inline-flex shrink-0 items-center justify-center rounded-md"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        style={{ width: px * 0.72, height: px * 0.72 }}
      >
        {style.glyph}
      </svg>
    </span>
  );
}
