import "server-only";
import { notFound } from "next/navigation";
import {
  dashboardModuleEnabled,
  type DashboardModule,
} from "@/features/layout/models/dashboard-module";

/** A 404 for the dashboard pages that `DASHBOARD_MODULE` turns off. */
export function requireDashboards(module: DashboardModule): void {
  if (!dashboardModuleEnabled(module, process.env.DASHBOARD_MODULE)) {
    notFound();
  }
}
