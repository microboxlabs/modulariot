"use client";

import type { CSSProperties, Dispatch, FC } from "react";
import { Dropdown, DropdownItem } from "flowbite-react";
import {
  LuArrowLeft,
  LuArrowRight,
  LuFileText,
  LuFlaskConical,
  LuFolderTree,
  LuGitCompare,
  LuHistory,
  LuPanelRight,
  LuX,
} from "react-icons/lu";
import { twMerge } from "tailwind-merge";
import {
  useHarnessChatTr,
  type TrFn,
} from "@/features/harness-chat/context/harness-chat-i18n-context";
import {
  workItemKey,
  type WorkItem,
} from "@/features/harness-chat/context/work-area-context";
import type { KnowledgeChange } from "@/features/harness-chat/extensions/knowledge-change-args";
import { PanelResizeHandle } from "@/features/harness-chat/components/panel-resize-handle";
import { useResizablePanelWidth } from "@/features/harness-chat/hooks/use-resizable-panel-width";
import {
  currentItem,
  type WorkAreaAction,
  type WorkAreaState,
} from "../work-area-state";
import { ChangesView } from "./changes-view";
import { EvalView } from "./eval-view";
import { FileView } from "./file-view";
import { LayersTree } from "./layers-tree";

const WIDTH_KEY = "harness-learning-work-area-width";

const iconButtonClass =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:pointer-events-none disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100";

export function workItemLabel(item: WorkItem, tr: TrFn): string {
  switch (item.kind) {
    case "file":
      return item.path;
    case "eval":
      return tr("harnessChat.learning.eval.heading");
    case "layers":
      return tr("harnessChat.learning.view.layers");
    case "changes":
      return tr("harnessChat.learning.view.diff");
  }
}

const ICONS = {
  file: LuFileText,
  eval: LuFlaskConical,
  layers: LuFolderTree,
  changes: LuGitCompare,
} as const;

const ItemBody: FC<{
  item: WorkItem;
  onOpen: (item: WorkItem) => void;
  changesOf: (threadId: string) => KnowledgeChange[];
}> = ({ item, onOpen, changesOf }) => {
  switch (item.kind) {
    case "file":
      return <FileView key={workItemKey(item)} item={item} />;
    case "eval":
      return <EvalView key={workItemKey(item)} item={item} />;
    case "layers":
      return <LayersTree onOpen={onOpen} />;
    case "changes":
      return <ChangesView changes={changesOf(item.threadId)} />;
  }
};

/**
 * The working area next to the chat. Closed until a card opens something in
 * it; what was opened stays as a list of recent items to go back and forth
 * through. A full-height overlay on narrow screens.
 */
export const WorkAreaPanel: FC<{
  state: WorkAreaState;
  dispatch: Dispatch<WorkAreaAction>;
  onOpen: (item: WorkItem) => void;
  changesOf: (threadId: string) => KnowledgeChange[];
}> = ({ state, dispatch, onOpen, changesOf }) => {
  const tr = useHarnessChatTr();
  const resizable = useResizablePanelWidth(WIDTH_KEY);
  const item = currentItem(state);
  if (!state.open) return null;
  const Icon = item ? ICONS[item.kind] : LuPanelRight;
  const title = item
    ? workItemLabel(item, tr)
    : tr("harnessChat.learning.work.title");

  return (
    <aside
      aria-label={tr("harnessChat.learning.work.title")}
      style={{ "--work-area-width": `${resizable.width}px` } as CSSProperties}
      className={twMerge(
        "fixed inset-0 z-50 flex flex-col bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-300",
        "lg:relative lg:inset-auto lg:z-auto lg:w-[var(--work-area-width)] lg:shrink-0 lg:border-l lg:border-gray-200 lg:dark:border-gray-700"
      )}
    >
      <div className="hidden lg:contents">
        <PanelResizeHandle
          label={tr("harnessChat.learning.work.resize")}
          resizable={resizable}
        />
      </div>
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-gray-200 px-2 lg:pl-4 dark:border-gray-700">
        <button
          type="button"
          onClick={() => dispatch({ type: "back" })}
          disabled={state.index <= 0}
          aria-label={tr("harnessChat.learning.work.back")}
          title={tr("harnessChat.learning.work.back")}
          className={iconButtonClass}
        >
          <LuArrowLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "forward" })}
          disabled={state.index >= state.items.length - 1}
          aria-label={tr("harnessChat.learning.work.forward")}
          title={tr("harnessChat.learning.work.forward")}
          className={iconButtonClass}
        >
          <LuArrowRight className="h-4 w-4" />
        </button>
        <Icon aria-hidden className="ml-1 h-4 w-4 shrink-0 text-gray-400" />
        <h2
          className="min-w-0 flex-1 truncate text-xs font-medium text-gray-800 dark:text-gray-100"
          title={title}
        >
          {title}
        </h2>
        {state.items.length > 1 && (
          <Dropdown
            label=""
            dismissOnClick
            placement="bottom-end"
            renderTrigger={() => (
              <button
                type="button"
                aria-label={tr("harnessChat.learning.work.recent")}
                title={tr("harnessChat.learning.work.recent")}
                className={iconButtonClass}
              >
                <LuHistory className="h-4 w-4" />
              </button>
            )}
          >
            {state.items
              .map((recent, index) => ({ recent, index }))
              .reverse()
              .map(({ recent, index }) => {
                const RecentIcon = ICONS[recent.kind];
                return (
                  <DropdownItem
                    key={workItemKey(recent)}
                    onClick={() => dispatch({ type: "go", index })}
                    className={twMerge(
                      "max-w-72 gap-2 text-xs",
                      index === state.index && "font-semibold"
                    )}
                  >
                    <RecentIcon
                      aria-hidden
                      className="h-3.5 w-3.5 shrink-0 text-gray-400"
                    />
                    <span className="truncate">
                      {workItemLabel(recent, tr)}
                    </span>
                  </DropdownItem>
                );
              })}
          </Dropdown>
        )}
        <button
          type="button"
          onClick={() => dispatch({ type: "close" })}
          aria-label={tr("harnessChat.learning.work.close")}
          title={tr("harnessChat.learning.work.close")}
          className={iconButtonClass}
        >
          <LuX className="h-4 w-4" />
        </button>
      </div>
      {item ? (
        <ItemBody item={item} onOpen={onOpen} changesOf={changesOf} />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-xs text-gray-400 dark:text-gray-500">
          <LuPanelRight className="h-6 w-6" />
          <p>{tr("harnessChat.learning.work.empty")}</p>
          <button
            type="button"
            onClick={() => onOpen({ kind: "layers" })}
            className="mt-1 rounded-md border border-gray-300 px-2.5 py-1 font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {tr("harnessChat.learning.view.layers")}
          </button>
        </div>
      )}
    </aside>
  );
};
