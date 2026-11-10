"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { rememberKanbanView } from "../services/kanban-return";

/** Records this Kanban view so completing a task returns to it. */
export function useRememberKanbanView(): void {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    rememberKanbanView(search ? `${pathname}?${search}` : pathname);
  }, [pathname, search]);
}
