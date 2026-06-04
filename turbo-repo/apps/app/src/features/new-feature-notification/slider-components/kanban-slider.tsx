import { tr } from "../../i18n/tr.service";
import Fadeable from "../slider-components/fadeable";
import { typeDescriptor } from "../new-features";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import {
  HiViewBoards,
  HiDotsHorizontal,
  HiSearch,
  HiAdjustments,
  HiSortAscending,
  HiFilter,
  HiChevronDoubleLeft,
  HiRefresh,
} from "react-icons/hi";

function ActionChip({
  icon: Icon,
  label,
  delayMs,
  isActive,
}: Readonly<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  delayMs: number;
  isActive: boolean;
}>) {
  return (
    <Fadeable isActive={isActive} delayMs={delayMs} className="px-0!">
      <div className="flex flex-col items-center gap-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
    </Fadeable>
  );
}

export default function KanbanSlider(dict: I18nRecord) {
  const s = (key: string) => tr(`new_functionality.slider.kanban.${key}`, dict);

  return {
    id: "2.0",
    image: null,
    description: (isActive: boolean) => [
      // Slide 1 — Title announcement
      <div
        key="kanban-slide-1"
        className="flex h-full w-full flex-col items-center justify-center gap-4 px-6"
      >
        <Fadeable isActive={isActive} delayMs={200} className="w-full">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/30">
              <HiViewBoards className="h-8 w-8 text-blue-600 dark:text-blue-400" />
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

      // Slide 2 — Separated lanes + per-lane actions
      <div
        key="kanban-slide-2"
        className="flex h-full w-full flex-col items-center justify-center gap-6 px-6"
      >
        <Fadeable isActive={isActive} delayMs={200} className="w-full">
          <h3 className="text-center text-xl font-bold text-gray-900 dark:text-white">
            {s("slide2_title")}
          </h3>
        </Fadeable>

        <Fadeable isActive={isActive} delayMs={400} className="w-full">
          <div className="mx-auto w-56 rounded-lg bg-gray-100 p-3 dark:bg-gray-800">
            <div className="mb-2.5 flex items-center justify-between border-b border-gray-300 pb-2 dark:border-gray-700">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                {s("slide2_lane")}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-gray-200 px-[7px] text-[11px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  2
                </span>
                <HiDotsHorizontal className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="rounded-md bg-white p-2 text-xs font-semibold text-gray-900 shadow dark:bg-gray-700 dark:text-gray-100">
                1625094-V
              </div>
              <div className="rounded-md bg-white p-2 text-xs font-semibold text-gray-900 shadow dark:bg-gray-700 dark:text-gray-100">
                1524620-V
              </div>
            </div>
          </div>
        </Fadeable>

        <div className="flex w-full max-w-xs justify-center gap-4">
          <ActionChip
            icon={HiAdjustments}
            label={s("slide2_density")}
            isActive={isActive}
            delayMs={700}
          />
          <ActionChip
            icon={HiSortAscending}
            label={s("slide2_sort")}
            isActive={isActive}
            delayMs={850}
          />
          <ActionChip
            icon={HiFilter}
            label={s("slide2_filter")}
            isActive={isActive}
            delayMs={1000}
          />
          <ActionChip
            icon={HiChevronDoubleLeft}
            label={s("slide2_collapse")}
            isActive={isActive}
            delayMs={1150}
          />
        </div>
      </div>,

      // Slide 3 — ⌘K search
      <div
        key="kanban-slide-3"
        className="flex h-full w-full flex-col items-center justify-center gap-6 px-6"
      >
        <Fadeable isActive={isActive} delayMs={200} className="w-full">
          <h3 className="text-center text-xl font-bold text-gray-900 dark:text-white">
            {s("slide3_title")}
          </h3>
        </Fadeable>

        <Fadeable isActive={isActive} delayMs={500} className="w-full">
          <div className="mx-auto flex max-w-70 items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
            <HiSearch className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="flex-1 text-sm text-gray-400">
              {s("slide3_placeholder")}
            </span>
            <kbd className="rounded border border-gray-200 bg-gray-100 px-1.5 font-mono text-[10px] text-gray-400 dark:border-gray-600 dark:bg-gray-700">
              ⌘K
            </kbd>
          </div>
        </Fadeable>

        <Fadeable isActive={isActive} delayMs={800} className="w-full">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            {s("slide3_desc")}
          </p>
        </Fadeable>
      </div>,

      // Slide 4 — Persisted view
      <div
        key="kanban-slide-4"
        className="flex h-full w-full flex-col items-center justify-center gap-6 px-6"
      >
        <Fadeable isActive={isActive} delayMs={200} className="w-full">
          <h3 className="text-center text-xl font-bold text-gray-900 dark:text-white">
            {s("slide4_title")}
          </h3>
        </Fadeable>

        <Fadeable isActive={isActive} delayMs={500} className="w-full">
          <div className="flex items-center justify-center gap-4">
            {/* collapsed lane */}
            <div className="h-20 w-7 rounded-lg bg-gray-100 dark:bg-gray-800" />
            {/* expanded lane with cards */}
            <div className="flex h-20 w-20 flex-col gap-1 rounded-lg bg-gray-100 p-1.5 dark:bg-gray-800">
              <div className="h-2 w-2/3 rounded bg-gray-300 dark:bg-gray-600" />
              <div className="h-4 w-full rounded bg-white shadow dark:bg-gray-700" />
              <div className="h-4 w-full rounded bg-white shadow dark:bg-gray-700" />
            </div>
            <HiRefresh className="h-6 w-6 text-blue-500 dark:text-blue-400" />
            <div className="h-20 w-7 rounded-lg bg-gray-100 dark:bg-gray-800" />
            <div className="flex h-20 w-20 flex-col gap-1 rounded-lg bg-gray-100 p-1.5 dark:bg-gray-800">
              <div className="h-2 w-2/3 rounded bg-gray-300 dark:bg-gray-600" />
              <div className="h-4 w-full rounded bg-white shadow dark:bg-gray-700" />
              <div className="h-4 w-full rounded bg-white shadow dark:bg-gray-700" />
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
