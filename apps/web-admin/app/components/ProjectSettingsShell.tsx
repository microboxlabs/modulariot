"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Settings, Key, Database, Shield, HardDrive, CreditCard, BarChart3 } from "lucide-react";

interface ProjectSettingsShellProps {
  children: React.ReactNode;
}

export default function ProjectSettingsShell({ children }: ProjectSettingsShellProps) {
  const params = useParams();
  const pathname = usePathname();
  const orgId = params.orgId as string;
  const projectId = params.projectId as string;

  const navSections = [
    {
      title: "PROJECT SETTINGS",
      items: [
        {
          id: "general",
          title: "General",
          href: `/org/${orgId}/project/${projectId}/settings/general`,
          icon: Settings,
        },
        {
          id: "api-keys",
          title: "API Keys",
          href: `/org/${orgId}/project/${projectId}/settings/api-keys`,
          icon: Key,
        },
        {
          id: "data-api",
          title: "Data API",
          href: `/org/${orgId}/project/${projectId}/settings/data-api`,
          icon: Database,
        },
      ],
    },
    {
      title: "CONFIGURATION",
      items: [
        {
          id: "authentication",
          title: "Authentication",
          href: `/org/${orgId}/project/${projectId}/settings/authentication`,
          icon: Shield,
        },
        {
          id: "storage",
          title: "Storage",
          href: `/org/${orgId}/project/${projectId}/settings/storage`,
          icon: HardDrive,
        },
      ],
    },
    {
      title: "BILLING",
      items: [
        {
          id: "subscription",
          title: "Subscription",
          href: `/org/${orgId}/project/${projectId}/settings/subscription`,
          icon: CreditCard,
        },
        {
          id: "usage",
          title: "Usage",
          href: `/org/${orgId}/project/${projectId}/settings/usage`,
          icon: BarChart3,
        },
      ],
    },
  ];

  const isActiveLink = (href: string) => {
    return pathname === href;
  };

  return (
    <div className="flex min-h-screen w-full">
      {/* Left Sidebar */}
      <div className="w-60 border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto py-6">
            <nav className="space-y-8 px-4">
              {navSections.map((section) => (
                <div key={section.title}>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {section.title}
                  </h3>
                  <ul className="space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = isActiveLink(item.href);
                      
                      return (
                        <li key={item.id}>
                          <Link
                            href={item.href}
                            className={`
                              group flex items-center rounded-md px-3 py-2 text-sm font-medium
                              ${isActive
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200"
                                : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                              }
                            `}
                          >
                            <Icon
                              className={`
                                mr-3 h-5 w-5 flex-shrink-0
                                ${isActive
                                  ? "text-blue-500 dark:text-blue-300"
                                  : "text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400"
                                }
                              `}
                            />
                            {item.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-50 dark:bg-gray-800">
        <div className="mx-auto max-w-4xl p-8">
          {children}
        </div>
      </div>
    </div>
  );
}