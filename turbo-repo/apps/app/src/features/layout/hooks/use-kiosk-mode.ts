"use client";

import { useSearchParams } from "next/navigation";

export const KIOSK_PARAM = "kiosk";

export function useKioskMode(): boolean {
  const searchParams = useSearchParams();
  return searchParams.get(KIOSK_PARAM) === "true";
}
