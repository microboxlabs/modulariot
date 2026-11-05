import type { ReactNode } from "react";
import { requireBoard } from "@/features/layout/services/board-guard";

export default function KanbanModelLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  requireBoard("kanban");
  return children;
}
