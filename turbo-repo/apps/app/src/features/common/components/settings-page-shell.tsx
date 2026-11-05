import type { ComponentType, ReactNode, SVGProps } from "react";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import FilterStrip from "./filter-strip";

/**
 * A settings page with a list beside its detail (Organizaciones, Plataforma, Comunicaciones):
 * a fixed breadcrumb bar, then a capped column with the icon, title, description and the
 * page's main action. Filters go in a full-width row under the breadcrumb. The children scroll
 * inside the column.
 */
export default function SettingsPageShell({
  breadcrumbDict,
  lang,
  path,
  icon: Icon,
  title,
  description,
  actions,
  filters,
  children,
}: Readonly<{
  breadcrumbDict: I18nRecord;
  lang: string;
  path: string[];
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
}>) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex w-full items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
        <Breadcrumb
          dict={breadcrumbDict}
          lang={lang}
          path={path}
          disableLinks
        />
      </div>
      {filters && <FilterStrip>{filters}</FilterStrip>}

      <div className="mx-auto flex min-h-0 w-full max-w-screen-2xl flex-1 flex-col gap-4 px-4 pb-6 pt-2 dark:bg-gray-900">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Icon className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {title}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {description}
              </p>
            </div>
          </div>
          {actions}
        </div>
        {children}
      </div>
    </div>
  );
}
