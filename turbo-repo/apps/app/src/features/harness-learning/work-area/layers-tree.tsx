"use client";

import type { FC, ReactNode } from "react";
import useSWR from "swr";
import { Spinner } from "flowbite-react";
import {
  LuChevronRight,
  LuFileText,
  LuFolder,
  LuRefreshCw,
} from "react-icons/lu";
import { twMerge } from "tailwind-merge";
import { useHarnessChatTr } from "@/features/harness-chat/context/harness-chat-i18n-context";
import type { WorkItem } from "@/features/harness-chat/context/work-area-context";
import { virtualPath } from "@/features/harness-chat/extensions/knowledge-change-args";
import {
  fetchLayers,
  type KnowledgeLayer,
  type KnowledgeSummary,
} from "@/features/harness-chat/knowledge-api";
import {
  LAYER_DOT,
  layerLabel,
} from "@/features/harness-chat/components/learning/labels";

export const LAYERS_KEY = "knowledge-layers";

const rowClass =
  "flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700/60";

const ItemRow: FC<{
  layer: string;
  item: KnowledgeSummary;
  onOpen: (item: WorkItem) => void;
}> = ({ layer, item, onOpen }) => {
  const path = virtualPath(layer, item.id, item.target) ?? item.id;
  return (
    <li>
      <button
        type="button"
        onClick={() =>
          onOpen({
            kind: "file",
            layer,
            id: item.id,
            target: item.target,
            path,
          })
        }
        className={rowClass}
        title={path}
      >
        <LuFileText
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 text-gray-400"
        />
        <span className="min-w-0 flex-1 truncate">{item.title || item.id}</span>
        {item.version !== null && (
          <span className="shrink-0 font-mono text-[10px] text-gray-400">
            v{item.version}
          </span>
        )}
      </button>
    </li>
  );
};

/** Items grouped by their connection, for the layers that have one. */
function byTarget(items: KnowledgeSummary[]): [string, KnowledgeSummary[]][] {
  const groups = new Map<string, KnowledgeSummary[]>();
  for (const item of items) {
    const key = item.target ?? "";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

const Folder: FC<{
  label: string;
  count: number;
  open?: boolean;
  dotClass?: string;
  children: ReactNode;
}> = ({ label, count, open, dotClass, children }) => (
  <details open={open} className="group/folder">
    <summary
      className={twMerge(rowClass, "cursor-pointer list-none font-medium")}
    >
      <LuChevronRight
        aria-hidden
        className="h-3 w-3 shrink-0 text-gray-400 transition-transform group-open/folder:rotate-90"
      />
      {dotClass ? (
        <span
          aria-hidden
          className={twMerge("h-2 w-2 shrink-0 rounded-full", dotClass)}
        />
      ) : (
        <LuFolder aria-hidden className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-[10px] tabular-nums text-gray-400">
        {count}
      </span>
    </summary>
    <div className="ml-4 border-l border-gray-200 pl-1.5 dark:border-gray-700">
      {children}
    </div>
  </details>
);

const LayerFolder: FC<{
  layer: KnowledgeLayer;
  onOpen: (item: WorkItem) => void;
}> = ({ layer, onOpen }) => {
  const tr = useHarnessChatTr();
  const grouped = layer.layer === "fact" || layer.layer === "note";
  const label = `${layerLabel(layer.layer, tr)}${
    layer.editable ? "" : ` (${tr("harnessChat.learning.layersView.readOnly")})`
  }`;
  const dot = LAYER_DOT[layer.layer] ?? LAYER_DOT.note;
  let content: ReactNode;
  if (layer.items.length === 0) {
    content = (
      <p className="px-1.5 py-1 text-[11px] text-gray-400 dark:text-gray-500">
        {tr("harnessChat.learning.layersView.empty")}
      </p>
    );
  } else if (grouped) {
    content = byTarget(layer.items).map(([target, items]) => (
      <Folder key={target} label={target} count={items.length}>
        <ul>
          {items.map((item) => (
            <ItemRow
              key={item.id}
              layer={layer.layer}
              item={item}
              onOpen={onOpen}
            />
          ))}
        </ul>
      </Folder>
    ));
  } else {
    content = (
      <ul>
        {layer.items.map((item) => (
          <ItemRow
            key={item.id}
            layer={layer.layer}
            item={item}
            onOpen={onOpen}
          />
        ))}
      </ul>
    );
  }
  return (
    <Folder
      label={label}
      count={layer.items.length}
      open={layer.items.length > 0}
      dotClass={dot}
    >
      {content}
    </Folder>
  );
};

/** The editable knowledge as a tree: layers, their connections, their files. */
export const LayersTree: FC<{ onOpen: (item: WorkItem) => void }> = ({
  onOpen,
}) => {
  const tr = useHarnessChatTr();
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    LAYERS_KEY,
    fetchLayers,
    {
      revalidateOnFocus: false,
    }
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-2 dark:border-gray-700">
        <p className="flex-1 text-xs font-medium text-gray-700 dark:text-gray-200">
          {tr("harnessChat.learning.layersView.title")}
        </p>
        <button
          type="button"
          onClick={() => void mutate()}
          aria-label={tr("harnessChat.learning.layersView.refresh")}
          title={tr("harnessChat.learning.layersView.refresh")}
          className="flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <LuRefreshCw
            aria-hidden
            className={twMerge("h-3.5 w-3.5", isValidating && "animate-spin")}
          />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {isLoading && <Spinner size="md" className="mx-auto block" />}
        {error && (
          <p className="px-2 text-xs text-red-600 dark:text-red-400">
            {tr("harnessChat.learning.layersView.loadFailed")}
          </p>
        )}
        {data?.map((layer) => (
          <LayerFolder key={layer.layer} layer={layer} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
};
