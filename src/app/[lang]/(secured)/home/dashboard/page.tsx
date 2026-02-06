"use client";

import { DashboardProvider, DashboardView } from "@/features/dashboard";

export default function HomePage() {
  return (
    <div className="h-full overflow-auto p-4">
      <DashboardProvider>
        <DashboardView />
      </DashboardProvider>
    </div>
  );
}
