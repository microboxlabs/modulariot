/**
 * The right-click menu entries for a folder, a file, or the empty
 * panel, VS Code style.
 */
import {
  HiOutlineClipboard,
  HiOutlineClipboardCopy,
  HiOutlineDocumentAdd,
  HiOutlineDocumentDuplicate,
  HiOutlineFolderAdd,
  HiOutlineLockClosed,
  HiOutlinePencil,
  HiOutlineScissors,
  HiOutlineTag,
  HiOutlineTrash,
} from "react-icons/hi";
import type { ExplorerMenuItem } from "./explorer-context-menu";
import type { ExplorerTreeNode } from "./explorer-tree.types";
import type { ExplorerActions } from "./use-explorer-actions";

/** What was right-clicked: a node and the folder holding it, or the panel. */
export interface ExplorerMenuTarget {
  node: ExplorerTreeNode | null;
  parentId: string | null;
}

/** Modifier shown in shortcut hints: ⌘ on macOS, Ctrl elsewhere. */
export function modifierLabel(): string {
  const isMac =
    globalThis.navigator !== undefined &&
    globalThis.navigator.userAgent.includes("Mac");
  return isMac ? "⌘" : "Ctrl+";
}

/** Where a paste on this target lands: into a folder, or beside a file. */
export function pasteTargetOf(target: ExplorerMenuTarget): string | null {
  return target.node?.kind === "folder" ? target.node.id : target.parentId;
}

function createItems(
  folderId: string | null,
  actions: ExplorerActions,
  t: (key: string) => string
): ExplorerMenuItem[] {
  // Inside a folder, creating needs the Editor role on it.
  const locked = folderId !== null && !actions.folderAllows(folderId, "edit");
  return [
    {
      key: "newFile",
      label: t("newFile"),
      icon: HiOutlineDocumentAdd,
      disabled:
        actions.isNamingNew || actions.busy || !actions.canCreateFile || locked,
      onSelect: () => actions.createFile(folderId),
    },
    {
      key: "newFolder",
      label: t("newFolder"),
      icon: HiOutlineFolderAdd,
      disabled: actions.isNamingNew || actions.busy || locked,
      onSelect: () => actions.createFolder(folderId),
    },
  ];
}

/**
 * `ids` is what the menu acts on: the whole selection when the right-clicked
 * node is part of it, otherwise just that node.
 */
export function buildMenuItems(
  target: ExplorerMenuTarget,
  ids: string[],
  actions: ExplorerActions,
  t: (key: string) => string
): ExplorerMenuItem[] {
  const mod = modifierLabel();
  const paste: ExplorerMenuItem = {
    key: "paste",
    label: t("menu.paste"),
    icon: HiOutlineClipboard,
    shortcut: `${mod}V`,
    disabled: actions.clipboard === null || actions.busy,
    separated: true,
    onSelect: () => actions.paste(pasteTargetOf(target)),
  };

  const { node } = target;
  // The empty panel creates in the folder it shows.
  if (!node) return [...createItems(target.parentId, actions, t), paste];

  const items: ExplorerMenuItem[] = [];
  const single = ids.length <= 1;
  if (node.kind === "folder" && single) {
    items.push(...createItems(node.id, actions, t));
  }
  items.push(
    {
      key: "clone",
      label: t("menu.clone"),
      icon: HiOutlineDocumentDuplicate,
      separated: node.kind === "folder" && single,
      // Folders cannot be copied yet; dashboards in the selection can.
      disabled: !actions.canCopy(ids),
      onSelect: () => actions.clone(ids),
    },
    {
      key: "cut",
      label: t("menu.cut"),
      icon: HiOutlineScissors,
      shortcut: `${mod}X`,
      separated: true,
      onSelect: () => actions.cut(ids),
    },
    {
      key: "copy",
      label: t("menu.copy"),
      icon: HiOutlineClipboardCopy,
      shortcut: `${mod}C`,
      disabled: !actions.canCopy(ids),
      onSelect: () => actions.copy(ids),
    },
    { ...paste, separated: false }
  );
  if (single && node.href) {
    items.push({
      key: "editTags",
      label: t("menu.editTags"),
      icon: HiOutlineTag,
      separated: true,
      disabled: actions.busy,
      onSelect: () => actions.editTags(node.id),
    });
  }
  const isFolder = node.kind === "folder";
  const canRename = single;
  if (canRename) {
    items.push({
      key: "rename",
      label: t("menu.rename"),
      icon: HiOutlinePencil,
      separated: true,
      disabled: isFolder
        ? !actions.folderAllows(node.id, "edit")
        : !node.isDraft && actions.busy,
      onSelect: () => actions.setEditingId(node.id),
    });
  }
  const canManage =
    isFolder && single && actions.folderAllows(node.id, "manage");
  if (canManage) {
    items.push({
      key: "permissions",
      label: t("menu.permissions"),
      icon: HiOutlineLockClosed,
      separated: !canRename,
      disabled: actions.busy,
      onSelect: () => actions.editPermissions(node.id),
    });
  }
  items.push({
    key: "delete",
    label: t("menu.delete"),
    icon: HiOutlineTrash,
    shortcut: "Del",
    danger: true,
    separated: !canRename && !canManage,
    // Deleting a folder needs the Coordinator role on each one selected.
    disabled: ids.some(
      (id) => actions.isFolder(id) && !actions.folderAllows(id, "manage")
    ),
    onSelect: () => actions.requestDelete(ids),
  });
  return items;
}

export type ExplorerKeyCommand =
  | "copy"
  | "cut"
  | "paste"
  | "delete"
  | "deselect"
  | "menu";

const MOD_KEYS: Record<string, ExplorerKeyCommand> = {
  c: "copy",
  x: "cut",
  v: "paste",
};

/** VS Code-like shortcuts on a focused row. */
export function keyCommand(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}): ExplorerKeyCommand | null {
  const withMod = event.metaKey || event.ctrlKey;
  if (withMod && event.key === "Backspace") return "delete";
  if (withMod) return MOD_KEYS[event.key.toLowerCase()] ?? null;
  if (event.key === "Delete") return "delete";
  if (event.key === "Escape") return "deselect";
  if (event.key === "ContextMenu") return "menu";
  if (event.shiftKey && event.key === "F10") return "menu";
  return null;
}
