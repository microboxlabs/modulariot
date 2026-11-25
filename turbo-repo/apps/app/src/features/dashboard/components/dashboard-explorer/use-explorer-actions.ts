"use client";

/**
 * What the explorer can do to its items: create, rename, copy, cut, paste,
 * clone, delete and move, plus the confirmations delete and move ask for.
 *
 * Every change is sent to the dashboard server (see use-explorer-server.ts).
 * The only state kept here is what the server has no notion of: the item
 * being named before it is created, the clipboard, and pending confirmations.
 */
import { useCallback, useMemo, useState } from "react";
import { trDynamic } from "@/features/i18n/tr.service";
import { ShowNotification } from "@/features/notifications/notification";
import { folderAllows, type FolderAbility } from "./explorer-folder-roles";
import type { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import {
  addDraftFile,
  addFolder,
  countInside,
  ensureUniqueName,
  moveNodes,
  nameOf,
  namesInFolder,
  parentOf,
  renameNode,
  topLevelIds,
  uniqueName,
} from "./explorer-tree";
import type {
  ExplorerClipboard,
  ExplorerLayout,
  ExplorerSourceFile,
} from "./explorer-tree.types";
import { readExplorerLayout } from "./explorer-store";
import type { ExplorerServer } from "./use-explorer-server";

/** `name` is the item's name when there is one item, for the dialog title. */
export type PendingConfirm =
  | { kind: "delete"; ids: string[]; name: string; inside: number }
  | {
      kind: "move";
      ids: string[];
      name: string;
      targetId: string | null;
      targetName: string | null;
    };

/** The dashboard whose tags are being edited. */
export interface TagsEditing {
  id: string;
  name: string;
  tags: readonly string[];
}

/** Which message the error toast shows after a failed change. */
type ExplorerErrorKey = "forbidden" | "conflict" | "generic";

interface UseExplorerActionsArgs {
  /** Server folders and dashboards, with the local items merged in. */
  layout: ExplorerLayout;
  /** Changes the local part only: open folders and items being named. */
  update: (fn: (current: ExplorerLayout) => ExplorerLayout) => void;
  /** Builds the merged layout from a local one, for reads after an update. */
  merge: (local: ExplorerLayout) => ExplorerLayout;
  sources: readonly ExplorerSourceFile[];
  server: ExplorerServer;
  dict: PropsWithI18nDict["dict"];
  /** Called after creating an item, so a search does not hide it. */
  onCreated: () => void;
  /** Called after a delete, so the selection drops what is gone. */
  onDeleted: () => void;
  /** Opens a dashboard just created, by its explorer id. */
  onOpen: (id: string) => void;
}

const TEMP_PREFIX = "temp-";

/** Items that exist only while they are being named. */
function isTemporary(id: string): boolean {
  return id.startsWith(TEMP_PREFIX);
}

function errorKeyOf(error: unknown): ExplorerErrorKey {
  const status = (error as { status?: unknown } | null)?.status;
  if (status === 401 || status === 403) return "forbidden";
  if (status === 409) return "conflict";
  return "generic";
}

function withoutTemporary(local: ExplorerLayout, id: string): ExplorerLayout {
  const keep = <T>(record: Record<string, T>) =>
    Object.fromEntries(Object.entries(record).filter(([key]) => key !== id));
  return { ...local, folders: keep(local.folders), drafts: keep(local.drafts) };
}

export function useExplorerActions({
  layout,
  update,
  merge,
  sources,
  server,
  dict,
  onCreated,
  onDeleted,
  onOpen,
}: UseExplorerActionsArgs) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const isNamingNew = editingId !== null && isTemporary(editingId);
  const [clipboard, setClipboard] = useState<ExplorerClipboard | null>(null);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [tagsEditing, setTagsEditing] = useState<TagsEditing | null>(null);

  const toast = useCallback(
    (key: string, params?: Record<string, string>) =>
      trDynamic(`explorer.toasts.${key}`, dict, params),
    [dict]
  );

  /**
   * Runs one server change and says how it went in a toast: `success` when
   * it worked, the reason when it did not.
   */
  const run = useCallback(
    async (change: () => Promise<void>, success?: string) => {
      setBusy(true);
      try {
        await change();
        if (success) ShowNotification({ type: "success", message: success });
      } catch (failure) {
        ShowNotification({
          type: "error",
          message: trDynamic(`explorer.errors.${errorKeyOf(failure)}`, dict),
        });
      } finally {
        setBusy(false);
      }
    },
    [dict]
  );

  const create = useCallback(
    (kind: "folder" | "draft", parentId: string | null) => {
      if (isNamingNew || busy) return;
      if (kind === "draft" && !server.canCreate) return;
      const id = `${TEMP_PREFIX}${kind}-${crypto.randomUUID()}`;
      const add = kind === "folder" ? addFolder : addDraftFile;
      const name = trDynamic(
        kind === "folder" ? "explorer.untitledFolder" : "explorer.untitledFile",
        dict
      );
      const named = ensureUniqueName(
        add(layout, { id, name, parentId }),
        id,
        sources
      );
      const unique = (named.folders[id] ?? named.drafts[id])?.name ?? name;
      // Added against the merged layout, so a server folder counts as an
      // existing parent; only the new item and open folders are kept locally.
      update((local) => {
        const added = add(merge(local), { id, name: unique, parentId });
        const item = { [id]: added.folders[id] ?? added.drafts[id]! };
        return {
          ...local,
          ...(kind === "folder"
            ? { folders: { ...local.folders, ...item } }
            : { drafts: { ...local.drafts, ...item } }),
          expanded: added.expanded,
        };
      });
      onCreated();
      setEditingId(id);
    },
    [
      isNamingNew,
      busy,
      server.canCreate,
      dict,
      layout,
      sources,
      update,
      merge,
      onCreated,
    ]
  );

  /** A new item's name is final: create it on the server. */
  const submitNew = useCallback(
    (id: string) => {
      const local = readExplorerLayout();
      const folder = local.folders[id];
      const draft = local.drafts[id];
      const item = folder ?? draft;
      // Enter commits and the blur that follows commits again: only once.
      if (!item) return;
      void run(
        async () => {
          try {
            if (folder) await server.createFolder(item.name, item.parentId);
            else onOpen(await server.createDashboard(item.name, item.parentId));
          } finally {
            update((current) => withoutTemporary(current, id));
          }
        },
        toast(folder ? "folderCreated" : "dashboardCreated", {
          name: item.name,
        })
      );
    },
    [run, server, update, onOpen, toast]
  );

  /** A saved dashboard keeps its slug; only the name in its config changes. */
  const renameDashboard = useCallback(
    (source: ExplorerSourceFile, name: string) => {
      const named = sources.map((s) =>
        s.id === source.id ? { ...s, name } : s
      );
      const unique =
        ensureUniqueName(layout, source.id, named).sourceNames[source.id] ??
        name;
      if (unique === source.name) return;
      void run(
        () => server.renameDashboard(source.id, unique),
        toast("dashboardRenamed", { name: unique })
      );
    },
    [sources, layout, run, server, toast]
  );

  const rename = useCallback(
    (id: string, name: string) => {
      if (isTemporary(id)) {
        // Still local: the server hears the name when naming ends.
        update((local) => {
          const renamed = renameNode(local, id, name);
          const unique = ensureUniqueName(merge(renamed), id, sources);
          const final = unique.folders[id] ?? unique.drafts[id];
          return final ? renameNode(renamed, id, final.name) : renamed;
        });
        return;
      }
      if (!name.trim()) return;
      const source = sources.find((s) => s.id === id);
      if (source) {
        renameDashboard(source, name.trim());
        return;
      }
      if (!layout.folders[id]) return;
      const unique = ensureUniqueName(renameNode(layout, id, name), id, sources)
        .folders[id]?.name;
      if (!unique || unique === layout.folders[id]?.name) return;
      void run(
        () => server.updateFolder(id, { name: unique }),
        toast("folderRenamed", { name: unique })
      );
    },
    [update, merge, sources, layout, run, server, toast, renameDashboard]
  );

  const stopRename = useCallback(() => {
    const id = editingId;
    setEditingId(null);
    if (id !== null && isTemporary(id)) submitNew(id);
  }, [editingId, submitNew]);

  /** Dashboards are copied; folders cannot be copied yet. */
  const copyInto = useCallback(
    (ids: string[], target: string | null | undefined) => {
      const dashboards = topLevelIds(layout, ids).filter(
        (id) => !layout.folders[id]
      );
      if (dashboards.length === 0) return;
      if (target) {
        update((local) => ({
          ...local,
          expanded: { ...local.expanded, [target]: true },
        }));
      }
      const success =
        dashboards.length === 1
          ? toast("copied", {
              name: nameOf(layout, dashboards[0]!, sources) ?? "",
            })
          : toast("copiedMany", { count: String(dashboards.length) });
      void run(async () => {
        const takenBy = new Map<string | null, Set<string>>();
        for (const id of dashboards) {
          const folderId = target === undefined ? parentOf(layout, id) : target;
          const taken =
            takenBy.get(folderId) ?? namesInFolder(layout, folderId, sources);
          takenBy.set(folderId, taken);
          const name = uniqueName(nameOf(layout, id, sources) ?? "", taken);
          taken.add(name);
          await server.copyDashboard(id, name, folderId);
        }
      }, success);
    },
    [layout, sources, update, run, server, toast]
  );

  const moveInto = useCallback(
    (ids: string[], target: string | null) => {
      const moved = moveNodes(layout, ids, target, sources);
      if (moved === layout) return;
      update((local) =>
        target === null
          ? local
          : { ...local, expanded: { ...local.expanded, [target]: true } }
      );
      const moving = topLevelIds(layout, ids);
      const where = target === null ? "ToTop" : "Into";
      const success =
        moving.length === 1
          ? toast(`moved${where}`, {
              name: nameOf(layout, moving[0]!, sources) ?? "",
              target:
                target === null ? "" : (nameOf(layout, target, sources) ?? ""),
            })
          : toast(`movedMany${where}`, {
              count: String(moving.length),
              target:
                target === null ? "" : (nameOf(layout, target, sources) ?? ""),
            });
      void run(async () => {
        for (const id of moving) {
          const folder = layout.folders[id];
          if (!folder) {
            await server.fileDashboard(id, target);
            continue;
          }
          if (folder.parentId === target) continue;
          const name = moved.folders[id]?.name ?? folder.name;
          await server.updateFolder(id, {
            parentId: target,
            ...(name === folder.name ? {} : { name }),
          });
        }
      }, success);
    },
    [layout, sources, update, run, server, toast]
  );

  const paste = useCallback(
    (targetFolderId: string | null) => {
      if (!clipboard) return;
      if (clipboard.mode === "cut") {
        moveInto(clipboard.ids, targetFolderId);
        setClipboard(null);
        return;
      }
      copyInto(clipboard.ids, targetFolderId);
    },
    [clipboard, moveInto, copyInto]
  );

  const requestDelete = useCallback(
    (selected: string[]) => {
      const ids = topLevelIds(layout, selected);
      const inside = ids.reduce(
        (sum, id) =>
          sum + (layout.folders[id] ? countInside(layout, id, sources) : 0),
        0
      );
      const name =
        ids.length === 1 ? (nameOf(layout, ids[0]!, sources) ?? "") : "";
      setPending({ kind: "delete", ids, name, inside });
    },
    [layout, sources]
  );

  /** A drop always asks first; a drop that changes nothing is ignored. */
  const requestMove = useCallback(
    (selected: string[], targetId: string | null) => {
      if (moveNodes(layout, selected, targetId, sources) === layout) return;
      const ids = topLevelIds(layout, selected);
      const nameIn = (id: string) => nameOf(layout, id, sources) ?? "";
      setPending({
        kind: "move",
        ids,
        name: ids.length === 1 ? nameIn(ids[0]!) : "",
        targetId,
        targetName: targetId ? nameIn(targetId) : null,
      });
    },
    [layout, sources]
  );

  const confirmPending = useCallback(() => {
    if (!pending) return;
    setPending(null);
    if (pending.kind === "move") {
      moveInto(pending.ids, pending.targetId);
      return;
    }
    setClipboard(null);
    const success =
      pending.ids.length === 1
        ? toast("deleted", { name: pending.name })
        : toast("deletedMany", { count: String(pending.ids.length) });
    void run(async () => {
      for (const id of pending.ids) {
        if (layout.folders[id]) await server.deleteFolder(id);
        else await server.deleteDashboard(id);
      }
      onDeleted();
    }, success);
  }, [pending, moveInto, run, layout, server, onDeleted, toast]);

  const toggleStar = useCallback(
    (id: string) => {
      const source = sources.find((s) => s.id === id);
      if (!source) return;
      const starring = source.starred !== true;
      const name = nameOf(layout, id, sources) ?? source.name;
      const key = starring ? "starring" : "unstarring";
      // One toast for the whole change: saving, then done or failed.
      const change = server.setStarred(id, starring);
      ShowNotification({
        type: "promise",
        promise: change,
        loading: toast(`${key}.loading`, { name }),
        ok: toast(`${key}.ok`, { name }),
        error: trDynamic("explorer.errors.generic", dict),
      });
      change.catch(() => undefined);
    },
    [sources, layout, server, toast, dict]
  );

  const editTags = useCallback(
    (id: string) => {
      const source = sources.find((s) => s.id === id);
      if (!source) return;
      setTagsEditing({
        id,
        name: nameOf(layout, id, sources) ?? source.name,
        tags: source.tags ?? [],
      });
    },
    [sources, layout]
  );

  const saveTags = useCallback(
    (tags: readonly string[]) => {
      const editing = tagsEditing;
      setTagsEditing(null);
      if (!editing) return;
      void run(
        () => server.setTags(editing.id, tags),
        toast("tagsSaved", { name: editing.name })
      );
    },
    [tagsEditing, run, server, toast]
  );

  const cancelTags = useCallback(() => setTagsEditing(null), []);

  // The folder whose own permissions are being edited.
  const [permissionsEditing, setPermissionsEditing] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const editPermissions = useCallback(
    (id: string) => {
      const folder = layout.folders[id];
      if (folder) setPermissionsEditing({ id, name: folder.name });
    },
    [layout.folders]
  );
  const closePermissions = useCallback(() => setPermissionsEditing(null), []);
  const cancelPending = useCallback(() => setPending(null), []);

  return useMemo(
    () => ({
      editingId,
      setEditingId,
      rename,
      stopRename,
      isNamingNew,
      busy,
      canCreateFile: server.canCreate,
      clipboard,
      copy: (ids: string[]) => setClipboard({ mode: "copy", ids }),
      cut: (ids: string[]) => setClipboard({ mode: "cut", ids }),
      /** Whether copy, clone and paste-as-copy have anything to act on. */
      canCopy: (ids: string[]) => ids.some((id) => !layout.folders[id]),
      paste,
      clone: (ids: string[]) => copyInto(ids, undefined),
      createFile: (parentId: string | null) => create("draft", parentId),
      createFolder: (parentId: string | null) => create("folder", parentId),
      requestDelete,
      requestMove,
      pending,
      confirmPending,
      cancelPending,
      toggleStar,
      tagsEditing,
      editTags,
      saveTags,
      cancelTags,
      /** The folder's role allows it; see `folderAllows`. */
      isFolder: (id: string) => layout.folders[id] !== undefined,
      folderAllows: (id: string, ability: FolderAbility) =>
        folderAllows(layout.folders[id], ability),
      permissionsEditing,
      editPermissions,
      closePermissions,
    }),
    [
      editingId,
      rename,
      stopRename,
      isNamingNew,
      busy,
      server.canCreate,
      clipboard,
      layout.folders,
      paste,
      copyInto,
      create,
      requestDelete,
      requestMove,
      pending,
      confirmPending,
      cancelPending,
      toggleStar,
      tagsEditing,
      editTags,
      saveTags,
      cancelTags,
      permissionsEditing,
      editPermissions,
      closePermissions,
    ]
  );
}

export type ExplorerActions = ReturnType<typeof useExplorerActions>;
