"use client";

import { usePathname } from "next/navigation";

// Deriva el idioma de la ruta /alpha-2506/{lang}/... (fallback: es).
export function useLang(): string {
  const p = usePathname() || "";
  return p.split("/")[2] || "es";
}
