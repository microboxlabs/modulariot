import type { ReactNode } from "react";
import { requireBoard } from "@/features/layout/services/board-guard";

export default function TripsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  requireBoard("trips");
  return children;
}
