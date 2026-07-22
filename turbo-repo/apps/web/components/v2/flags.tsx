import React from "react";

// Banderas SVG inline (DS-compliant, sin emoji). viewBox 20x14, esquinas suaves.
// Cada país se mapea a un idioma existente (es · en · pt) en content.*.ts.
const flags: Record<string, React.ReactNode> = {
  cl: (
    <>
      <rect width="20" height="14" fill="#ffffff" />
      <rect y="7" width="20" height="7" fill="#D52B1E" />
      <rect width="8" height="7" fill="#0039A6" />
      <path
        d="M4 1.5l.66 2.02h2.12l-1.72 1.25.66 2.02L4 5.54 2.28 6.79l.66-2.02L1.22 3.52h2.12z"
        fill="#ffffff"
      />
    </>
  ),
  pe: (
    <>
      <rect width="20" height="14" fill="#ffffff" />
      <rect width="6.67" height="14" fill="#D91023" />
      <rect x="13.33" width="6.67" height="14" fill="#D91023" />
    </>
  ),
  co: (
    <>
      <rect width="20" height="14" fill="#FCD116" />
      <rect y="7" width="20" height="3.5" fill="#003893" />
      <rect y="10.5" width="20" height="3.5" fill="#CE1126" />
    </>
  ),
  mx: (
    <>
      <rect width="20" height="14" fill="#ffffff" />
      <rect width="6.67" height="14" fill="#006847" />
      <rect x="13.33" width="6.67" height="14" fill="#CE1126" />
    </>
  ),
  br: (
    <>
      <rect width="20" height="14" fill="#009C3B" />
      <path d="M10 1.5l8 5.5-8 5.5-8-5.5z" fill="#FFDF00" />
      <circle cx="10" cy="7" r="2.6" fill="#002776" />
    </>
  ),
  gl: (
    <>
      <rect width="20" height="14" fill="#1C64F2" />
      <path
        d="M3 7h14M10 .8v12.4M5 3.4c2.6 1.5 7.4 1.5 10 0M5 10.6c2.6-1.5 7.4-1.5 10 0"
        stroke="#ffffff"
        strokeWidth="0.7"
        fill="none"
      />
      <ellipse
        cx="10"
        cy="7"
        rx="3.1"
        ry="6.2"
        stroke="#ffffff"
        strokeWidth="0.7"
        fill="none"
      />
    </>
  ),
};

export function Flag({
  code,
  className = "h-3.5 w-5",
}: {
  code: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 20 14"
      className={`${className} shrink-0 rounded-[2px] ring-1 ring-black/10`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
    >
      {flags[code] ?? flags.gl}
    </svg>
  );
}
