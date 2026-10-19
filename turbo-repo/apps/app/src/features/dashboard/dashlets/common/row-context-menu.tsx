"use client";
import "@microboxlabs/miot-dashboard-ui/styles.css";
import {
  RowContextMenu as PortableRowContextMenu,
  type RowContextMenuProps,
} from "@microboxlabs/miot-dashboard-ui/react";
import { useOptionalDashboard } from "@/features/dashboard/context/dashboard-context";
import { tr } from "@/features/i18n/tr.service";
export type { ResolvedContextItem } from "@microboxlabs/miot-dashboard-ui/react";

export function RowContextMenu(props: Omit<RowContextMenuProps, "ariaLabel">) {
  const { dictionary } = useOptionalDashboard();
  return (
    <PortableRowContextMenu
      {...props}
      ariaLabel={tr("dashboard.settings.moreActions", dictionary)}
    />
  );
}
