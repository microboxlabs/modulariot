import { tr } from "../../i18n/tr.service";
import Fadeable from "../slider-components/fadeable";
import { typeDescriptor } from "../new-features";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import {
  HiHome,
  HiCalendar,
  HiClipboardList,
  HiSearch,
  HiPlus,
  HiCog,
  HiDeviceMobile,
  HiDesktopComputer,
} from "react-icons/hi";

function SidebarIconMock({
  icon: Icon,
  active,
  label,
  delayMs,
  isActive,
}: Readonly<{
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  label?: string;
  delayMs: number;
  isActive: boolean;
}>) {
  return (
    <Fadeable isActive={isActive} className="px-0!" delayMs={delayMs}>
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            active
              ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
              : "text-gray-400 dark:text-gray-500"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        {label && (
          <span
            className={`text-sm ${
              active
                ? "font-semibold text-gray-900 dark:text-white"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {label}
          </span>
        )}
      </div>
    </Fadeable>
  );
}

export default function SidebarSlider(dict: I18nRecord) {
  const s = (key: string) =>
    tr(`new_functionality.slider.sidebar.${key}`, dict);

  return {
    id: "1.0",
    image: null,
    description: (isActive: boolean) => [
      // Slide 1 — Title announcement
      <div
        key="sidebar-slide-1"
        className="flex h-full w-full flex-col items-center justify-center gap-4 px-6"
      >
        <Fadeable isActive={isActive} delayMs={200} className="w-full">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/30">
              <HiDesktopComputer className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </Fadeable>
        <Fadeable isActive={isActive} delayMs={500} className="w-full">
          <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-white">
            {s("slide1_title")}
          </h2>
        </Fadeable>
        <Fadeable isActive={isActive} delayMs={800} className="w-full">
          <p className="text-center text-lg text-gray-500 dark:text-gray-300">
            {s("slide1_subtitle")}
          </p>
        </Fadeable>
      </div>,

      // Slide 2 — Two-level navigation visual
      <div
        key="sidebar-slide-2"
        className="flex h-full w-full flex-col items-center justify-center gap-6 px-6"
      >
        <Fadeable isActive={isActive} delayMs={200} className="w-full">
          <h3 className="text-center text-xl font-bold text-gray-900 dark:text-white">
            {s("slide2_title")}
          </h3>
        </Fadeable>

        <Fadeable isActive={isActive} delayMs={400} className="w-full">
          <div className="mx-auto flex max-w-xs overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
            {/* L1 mock */}
            <div className="flex flex-col items-center gap-2 border-r border-gray-200 p-3 dark:border-gray-700">
              <SidebarIconMock
                icon={HiHome}
                active
                isActive={isActive}
                delayMs={600}
              />
              <SidebarIconMock
                icon={HiCalendar}
                isActive={isActive}
                delayMs={700}
              />
              <SidebarIconMock
                icon={HiClipboardList}
                isActive={isActive}
                delayMs={800}
              />
              <SidebarIconMock
                icon={HiCog}
                isActive={isActive}
                delayMs={900}
              />
            </div>
            {/* L2 mock */}
            <div className="flex flex-1 flex-col gap-2 p-3">
              <Fadeable isActive={isActive} delayMs={1000} className="px-0!">
                <div className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">
                  Home
                </div>
              </Fadeable>
              <Fadeable isActive={isActive} delayMs={1100} className="px-0!">
                <div className="rounded-md bg-blue-50 px-2 py-1.5 text-sm font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                  Dashboard 1
                </div>
              </Fadeable>
              <Fadeable isActive={isActive} delayMs={1200} className="px-0!">
                <div className="rounded-md px-2 py-1.5 text-sm text-gray-500 dark:text-gray-400">
                  Dashboard 2
                </div>
              </Fadeable>
              <Fadeable isActive={isActive} delayMs={1300} className="px-0!">
                <div className="rounded-md px-2 py-1.5 text-sm text-gray-500 dark:text-gray-400">
                  Dashboard 3
                </div>
              </Fadeable>
            </div>
          </div>
        </Fadeable>

        <div className="flex w-full max-w-xs gap-4">
          <Fadeable
            isActive={isActive}
            delayMs={1000}
            className="flex-1 px-0!"
          >
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {s("slide2_icon_bar")}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {s("slide2_icon_bar_desc")}
              </p>
            </div>
          </Fadeable>
          <Fadeable
            isActive={isActive}
            delayMs={1200}
            className="flex-1 px-0!"
          >
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {s("slide2_secondary_panel")}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {s("slide2_secondary_panel_desc")}
              </p>
            </div>
          </Fadeable>
        </div>
      </div>,

      // Slide 3 — Search & Create
      <div
        key="sidebar-slide-3"
        className="flex h-full w-full flex-col items-center justify-center gap-6 px-6"
      >
        <Fadeable isActive={isActive} delayMs={200} className="w-full">
          <h3 className="text-center text-xl font-bold text-gray-900 dark:text-white">
            {s("slide3_title")}
          </h3>
        </Fadeable>

        <Fadeable isActive={isActive} delayMs={500} className="w-full">
          <div className="mx-auto flex max-w-70 items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
            <div className="relative flex-1">
              <HiSearch className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <div className="rounded-md border border-gray-300 py-1.5 pl-7 pr-2 text-sm text-gray-400 dark:border-gray-600 dark:bg-gray-700">
                Search...
              </div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <HiPlus className="h-4 w-4" />
            </div>
          </div>
        </Fadeable>

        <Fadeable isActive={isActive} delayMs={800} className="w-full">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            {s("slide3_desc")}
          </p>
        </Fadeable>
      </div>,

      // Slide 4 — Works on desktop and mobile
      <div
        key="sidebar-slide-4"
        className="flex h-full w-full flex-col items-center justify-center gap-6 px-6"
      >
        <Fadeable isActive={isActive} delayMs={200} className="w-full">
          <h3 className="text-center text-xl font-bold text-gray-900 dark:text-white">
            {s("slide4_title")}
          </h3>
        </Fadeable>

        <Fadeable isActive={isActive} delayMs={500} className="w-full">
          <div className="flex items-end justify-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-24 w-40 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <div className="flex h-full w-full">
                  <div className="flex w-8 flex-col items-center gap-1 border-r border-gray-200 py-2 dark:border-gray-700">
                    <div className="h-3 w-3 rounded bg-blue-200 dark:bg-blue-800" />
                    <div className="h-3 w-3 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-3 w-3 rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-2">
                    <div className="h-2 w-full rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-2 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-2 w-1/2 rounded bg-blue-200 dark:bg-blue-800" />
                  </div>
                </div>
              </div>
              <HiDesktopComputer className="h-5 w-5 text-gray-400" />
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="flex h-20 w-14 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <div className="flex h-full w-full">
                  <div className="flex w-5 flex-col items-center gap-0.5 border-r border-gray-200 py-1 dark:border-gray-700">
                    <div className="h-2 w-2 rounded bg-blue-200 dark:bg-blue-800" />
                    <div className="h-2 w-2 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-2 w-2 rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5 p-1">
                    <div className="h-1.5 w-full rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-1.5 w-3/4 rounded bg-blue-200 dark:bg-blue-800" />
                  </div>
                </div>
              </div>
              <HiDeviceMobile className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </Fadeable>

        <Fadeable isActive={isActive} delayMs={800} className="w-full">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            {s("slide4_desc")}
          </p>
        </Fadeable>
      </div>,
    ],
    type: typeDescriptor.Slidable,
  };
}
