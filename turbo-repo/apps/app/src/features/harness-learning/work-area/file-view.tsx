"use client";

import { useState, type FC, type ReactNode } from "react";
import useSWR from "swr";
import { Spinner } from "flowbite-react";
import { toast } from "sonner";
import {
  LuFileText,
  LuGitCompare,
  LuHistory,
  LuPencil,
  LuRotateCcw,
} from "react-icons/lu";
import { twMerge } from "tailwind-merge";
import { useHarnessChatTr } from "@/features/harness-chat/context/harness-chat-i18n-context";
import type { WorkItem } from "@/features/harness-chat/context/work-area-context";
import { DiffView } from "@/features/harness-chat/components/diff-view";
import {
  ChangeDiff,
  PathCrumbs,
} from "@/features/harness-chat/components/learning/knowledge-change-list";
import {
  badgeClass,
  LAYER_BADGE,
  layerLabel,
} from "@/features/harness-chat/components/learning/labels";
import {
  fetchItem,
  fetchItemVersion,
  revertItem,
  saveItem,
  type KnowledgeItem,
  type KnowledgeVersion,
} from "@/features/harness-chat/knowledge-api";

type FileItem = Extract<WorkItem, { kind: "file" }>;
type Mode = "changes" | "file" | "edit";

/** Layers a trainer can write; agent notes are read and deleted only. */
const EDITABLE_LAYERS = new Set(["fact", "rule", "skill", "primer", "eval"]);

const segmentClass =
  "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 aria-pressed:bg-white aria-pressed:text-gray-900 aria-pressed:shadow-sm dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100 dark:aria-pressed:bg-gray-700 dark:aria-pressed:text-white";

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      });
}

/** The version just before `version` in the item's history, if any. */
export function previousVersion(
  history: KnowledgeVersion[],
  version: number
): number | null {
  const older = history.map((h) => h.version).filter((v) => v < version);
  return older.length > 0 ? Math.max(...older) : null;
}

function useItem(item: FileItem) {
  return useSWR(
    ["knowledge-item", item.layer, item.id, item.target],
    () => fetchItem(item.layer, item.id, item.target),
    { revalidateOnFocus: false }
  );
}

function useVersionText(
  item: FileItem,
  version: number | null,
  current: KnowledgeItem | null
) {
  const isCurrent = version !== null && version === current?.version;
  const { data, isLoading } = useSWR(
    version === null || isCurrent
      ? null
      : ["knowledge-version", item.layer, item.id, item.target, version],
    () => fetchItemVersion(item.layer, item.id, item.target, version as number),
    { revalidateOnFocus: false }
  );
  if (version === null) return { text: "", isLoading: false };
  if (isCurrent) return { text: current?.content ?? "", isLoading: false };
  return { text: data?.content ?? "", isLoading };
}

/** One version against the one before it. */
const VersionDiff: FC<{
  item: FileItem;
  current: KnowledgeItem;
  version: number;
}> = ({ item, current, version }) => {
  const tr = useHarnessChatTr();
  const previous = previousVersion(current.history ?? [], version);
  const after = useVersionText(item, version, current);
  const before = useVersionText(item, previous, current);
  if (after.isLoading || before.isLoading) return <Spinner size="sm" />;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        {previous === null
          ? tr("harnessChat.learning.file.firstVersion")
          : tr("harnessChat.learning.file.vsPrevious", {
              version: String(version),
            })}
      </p>
      <DiffView oldText={before.text} newText={after.text} path={item.path} />
    </div>
  );
};

const HistoryList: FC<{
  history: KnowledgeVersion[];
  current: number | null;
  selected: number | null;
  editable: boolean;
  onSelect: (version: number) => void;
  onRevert: (version: number) => Promise<void>;
}> = ({ history, current, selected, editable, onSelect, onRevert }) => {
  const tr = useHarnessChatTr();
  const [confirming, setConfirming] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <ol className="flex flex-col divide-y divide-gray-100 dark:divide-gray-700/60">
      {history.map((entry) => (
        <li key={entry.version} className="flex flex-col gap-1 py-1.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelect(entry.version)}
              aria-pressed={selected === entry.version}
              className="flex min-w-0 flex-1 items-baseline gap-2 rounded px-1 text-left text-[11px] hover:bg-gray-50 aria-pressed:bg-blue-50 dark:hover:bg-gray-700/50 dark:aria-pressed:bg-blue-900/30"
            >
              <span className="font-mono font-medium text-gray-800 dark:text-gray-100">
                v{entry.version}
              </span>
              {entry.version === current && (
                <span className="text-[10px] text-green-700 dark:text-green-400">
                  {tr("harnessChat.learning.file.current")}
                </span>
              )}
              <span className="min-w-0 truncate text-gray-500 dark:text-gray-400">
                {[
                  entry.updated_by &&
                    tr("harnessChat.learning.file.by", {
                      by: entry.updated_by,
                    }),
                  formatDate(entry.updated_at),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
            {editable &&
              entry.version !== current &&
              confirming !== entry.version && (
                <button
                  type="button"
                  onClick={() => setConfirming(entry.version)}
                  className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                >
                  <LuRotateCcw aria-hidden className="h-3 w-3" />
                  {tr("harnessChat.learning.file.revert")}
                </button>
              )}
          </div>
          {entry.reason && (
            <p className="px-1 text-[11px] italic text-gray-500 dark:text-gray-400">
              {entry.reason}
            </p>
          )}
          {confirming === entry.version && (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              <span className="flex-1">
                {tr("harnessChat.learning.file.confirmRevert", {
                  version: String(entry.version),
                })}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(null)}
                className="rounded px-2 py-0.5 hover:bg-amber-100 dark:hover:bg-amber-900/40"
              >
                {tr("harnessChat.learning.file.cancel")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void onRevert(entry.version).finally(() => {
                    setBusy(false);
                    setConfirming(null);
                  });
                }}
                className="rounded bg-amber-600 px-2 py-0.5 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {tr("harnessChat.learning.file.revert")}
              </button>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
};

const Editor: FC<{
  item: FileItem;
  current: KnowledgeItem | null;
  onSaved: (saved: KnowledgeItem) => void;
  onCancel: () => void;
}> = ({ item, current, onSaved, onCancel }) => {
  const tr = useHarnessChatTr();
  const [title, setTitle] = useState(current?.title ?? item.id);
  const [content, setContent] = useState(current?.content ?? "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const saved = await saveItem(item.layer, item.id, item.target, {
        title,
        content,
        reason,
      });
      toast.success(tr("harnessChat.learning.file.saved"));
      onSaved(saved);
    } catch {
      toast.error(tr("harnessChat.learning.file.saveFailed"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form
      className="flex min-h-0 flex-1 flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600 dark:text-gray-300">
        {tr("harnessChat.learning.file.titleLabel")}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex min-h-0 flex-1 flex-col gap-1 text-[11px] font-medium text-gray-600 dark:text-gray-300">
        {tr("harnessChat.learning.file.contentLabel")}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
          className={twMerge(
            inputClass,
            "min-h-64 flex-1 resize-none font-mono leading-relaxed"
          )}
        />
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600 dark:text-gray-300">
        {tr("harnessChat.learning.file.reason")}
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={inputClass}
        />
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {tr("harnessChat.learning.file.cancel")}
        </button>
        <button
          type="submit"
          disabled={saving || !content.trim()}
          className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700"
        >
          {saving
            ? tr("harnessChat.learning.file.saving")
            : tr("harnessChat.learning.file.save")}
        </button>
      </div>
    </form>
  );
};

const muted = "text-xs text-gray-500 dark:text-gray-400";

/** What changed: the proposed change, if any, and the selected version
 * against the one before it. */
const ChangesBody: FC<{
  item: FileItem;
  current: KnowledgeItem | null;
  version: number | null;
}> = ({ item, current, version }) => {
  const tr = useHarnessChatTr();
  return (
    <div className="flex flex-col gap-4">
      {item.proposed && (
        <section className="flex flex-col gap-1.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            {tr("harnessChat.learning.file.proposed")}
          </h3>
          <ChangeDiff change={item.proposed} />
        </section>
      )}
      {current && version !== null && (
        <VersionDiff item={item} current={current} version={version} />
      )}
      {!current && !item.proposed && (
        <p className={muted}>{tr("harnessChat.learning.file.notFound")}</p>
      )}
    </div>
  );
};

const FullFile: FC<{ current: KnowledgeItem | null }> = ({ current }) => {
  const tr = useHarnessChatTr();
  if (!current)
    return <p className={muted}>{tr("harnessChat.learning.file.notFound")}</p>;
  return (
    <pre className="whitespace-pre-wrap break-words rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-[11px] leading-relaxed text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
      {current.content}
    </pre>
  );
};

const FileHeader: FC<{
  item: FileItem;
  current: KnowledgeItem | null;
  editable: boolean;
  mode: Mode;
  canEdit: boolean;
  onMode: (mode: Mode) => void;
}> = ({ item, current, editable, mode, canEdit, onMode }) => {
  const tr = useHarnessChatTr();
  const details = current
    ? [
        current.version === null ? null : `v${current.version}`,
        current.updated_by
          ? tr("harnessChat.learning.file.by", { by: current.updated_by })
          : null,
        current.updated_at ? formatDate(current.updated_at) : null,
      ].filter(Boolean)
    : [];
  return (
    <div className="flex flex-col gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
      <div className="flex min-w-0 items-center gap-2">
        <PathCrumbs path={item.path} className="min-w-0 flex-1 text-xs" />
        <span
          className={twMerge(
            badgeClass,
            LAYER_BADGE[item.layer] ?? LAYER_BADGE.note
          )}
        >
          {layerLabel(item.layer, tr)}
        </span>
        {!editable && (
          <span className="shrink-0 text-[10px] text-gray-400">
            {tr("harnessChat.learning.file.readOnly")}
          </span>
        )}
      </div>
      {current && (
        <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-200">
            {current.title}
          </span>
          {details.length > 0 && ` · ${details.join(" · ")}`}
        </p>
      )}
      <div className="flex items-center gap-1">
        <div className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
          <button
            type="button"
            aria-pressed={mode === "changes"}
            onClick={() => onMode("changes")}
            className={segmentClass}
          >
            <LuGitCompare aria-hidden className="h-3 w-3" />
            {tr("harnessChat.learning.file.changes")}
          </button>
          <button
            type="button"
            aria-pressed={mode === "file"}
            onClick={() => onMode("file")}
            className={segmentClass}
          >
            <LuFileText aria-hidden className="h-3 w-3" />
            {tr("harnessChat.learning.file.full")}
          </button>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => onMode("edit")}
            className="ml-auto flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <LuPencil aria-hidden className="h-3 w-3" />
            {tr("harnessChat.learning.file.edit")}
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * A knowledge file: what changed (a proposed change, or any version against
 * the one before), the whole file, its history with revert, and a manual edit
 * that is saved as a new version.
 */
export const FileView: FC<{ item: FileItem }> = ({ item }) => {
  const tr = useHarnessChatTr();
  const { data, error, isLoading, mutate } = useItem(item);
  const current = data ?? null;
  const [mode, setMode] = useState<Mode>("changes");
  const [selected, setSelected] = useState<number | null>(null);
  const editable = EDITABLE_LAYERS.has(item.layer);
  const history = current?.history ?? [];
  const version = selected ?? current?.version ?? null;

  const revert = async (target: number) => {
    try {
      const saved = await revertItem(item.layer, item.id, item.target, target);
      await mutate(saved, { revalidate: true });
      setSelected(null);
      toast.success(
        tr("harnessChat.learning.file.reverted", { version: String(target) })
      );
    } catch {
      toast.error(tr("harnessChat.learning.file.revertFailed"));
    }
  };

  let body: ReactNode;
  if (isLoading) body = <Spinner size="md" className="self-center" />;
  else if (error)
    body = (
      <p className="text-xs text-red-600 dark:text-red-400">
        {tr("harnessChat.learning.file.loadFailed")}
      </p>
    );
  else if (mode === "edit")
    body = (
      <Editor
        item={item}
        current={current}
        onCancel={() => setMode("changes")}
        onSaved={(saved) => {
          void mutate(saved, { revalidate: true });
          setSelected(null);
          setMode("changes");
        }}
      />
    );
  else if (mode === "file") body = <FullFile current={current} />;
  else body = <ChangesBody item={item} current={current} version={version} />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FileHeader
        item={item}
        current={current}
        editable={editable}
        mode={mode}
        canEdit={editable && mode !== "edit" && !error && !isLoading}
        onMode={setMode}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3">
        {body}
        {mode !== "edit" && history.length > 0 && (
          <section className="flex flex-col gap-1">
            <h3 className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <LuHistory aria-hidden className="h-3 w-3" />
              {tr("harnessChat.learning.file.history")}
            </h3>
            <HistoryList
              history={history}
              current={current?.version ?? null}
              selected={version}
              editable={editable}
              onSelect={(v) => {
                setSelected(v);
                setMode("changes");
              }}
              onRevert={revert}
            />
          </section>
        )}
      </div>
    </div>
  );
};
