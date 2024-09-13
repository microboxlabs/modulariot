import { twMerge } from "tailwind-merge";
import { HiCog } from "react-icons/hi";
import { Sidebar } from "flowbite-react";
import Link from "next/link";
import LifeSaver from "./LifeSaver";

export default function BottomMenu({ isCollapsed }: { isCollapsed: boolean }) {
  return (
    <div
      className={twMerge(
        "flex items-center justify-center gap-4 mb-9",
        isCollapsed && "flex-col",
      )}
    >
      <Sidebar.ItemGroup>
        <Sidebar.Item icon={HiCog}>
          <Link href="/users/settings">Ajustes</Link>
        </Sidebar.Item>
        <Sidebar.Item icon={LifeSaver}>
          <Link href="/help">Ayuda y cómo empezar</Link>
        </Sidebar.Item>
      </Sidebar.ItemGroup>
    </div>
  );
}
