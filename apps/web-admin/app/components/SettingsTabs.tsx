"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Tabs } from "flowbite-react";
import { Settings, Shield, FileText, ScrollText } from "lucide-react";

interface SettingsTabsProps {
  children: React.ReactNode;
}

export default function SettingsTabs({ children }: SettingsTabsProps) {
  const params = useParams();
  const pathname = usePathname();
  const orgId = params.orgId as string;

  const tabs = [
    {
      id: "general",
      title: "General",
      href: `/org/${orgId}/settings/general`,
      icon: Settings,
    },
    {
      id: "oauth",
      title: "OAuth Apps",
      href: `/org/${orgId}/settings/oauth`,
      icon: Shield,
    },
    {
      id: "audit",
      title: "Audit Logs",
      href: `/org/${orgId}/settings/audit`,
      icon: ScrollText,
    },
    {
      id: "legal",
      title: "Legal Documents",
      href: `/org/${orgId}/settings/legal`,
      icon: FileText,
    },
  ];

  const activeTab = tabs.find(tab => pathname.includes(tab.id))?.id || "general";

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`
                  group inline-flex items-center border-b-2 px-1 py-4 text-sm font-medium
                  ${isActive
                    ? "border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300"
                  }
                `}
              >
                <Icon
                  className={`
                    -ml-0.5 mr-2 h-5 w-5
                    ${isActive
                      ? "text-blue-500 dark:text-blue-400"
                      : "text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400"
                    }
                  `}
                />
                {tab.title}
              </Link>
            );
          })}
        </nav>
      </div>
      
      <div className="mt-6">
        {children}
      </div>
    </div>
  );
}