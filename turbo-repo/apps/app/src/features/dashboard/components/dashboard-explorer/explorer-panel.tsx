"use client";

/**
 * The dashboards page's file/folder explorer. Dashboards and folders come
 * from the dashboard server and every change is saved there (see
 * use-explorer-server.ts); only open folders and the item being named stay in
 * the browser. `dict` is the `dashboard` part of the dictionary.
 *
 * It shows one folder at a time, kept in the URL, as a list (a tree whose
 * folders also expand in place) or as cards; a breadcrumb leads back up.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { HiOutlineViewGrid, HiPlus } from "react-icons/hi";
import { HiOutlineSquares2X2 } from "react-icons/hi2";
import LayoutToggle from "@/features/common/components/layout-toggle";
import { twMerge } from "tailwind-merge";
import { trDynamic } from "@/features/i18n/tr.service";
import type { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import { pathNameWithoutLanguage } from "@/features/layout/utils/utils";
import { useLocalizedHref } from "@/features/layout/hooks/use-localized-href";
import ExplorerNewMenu from "./explorer-new-menu";
import ExplorerNode, {
  ParentRow,
  type ExplorerNodeHandlers,
  type ExplorerViewState,
} from "./explorer-node";
import {
  allTags,
  buildTree,
  flatMatches,
  sortNodes,
  sortTree,
  folderPath,
  isFaceted,
  NO_FACETS,
  nodesById,
  parentOf,
  toggleFolder,
  visibleOrder,
} from "./explorer-tree";
import ExplorerBreadcrumb from "./explorer-breadcrumb";
import ExplorerCards, {
  ExplorerCardsSkeleton,
  ExplorerFilterCard,
  type CardActivity,
  type ExplorerCardsParent,
  type ExplorerCardsView,
} from "./explorer-cards";
import { useExplorerViewMode, useOpenFolder } from "./explorer-navigation";
import {
  ExplorerHeader,
  LIST_FRAME_CLASS,
  type SelectAllState,
} from "./explorer-columns";
import ExplorerTagsDialog from "./explorer-tags-dialog";
import ExplorerPermissionsDialog from "./explorer-permissions-dialog";
import { ExplorerSkeletonRows } from "./explorer-skeleton";
import { LoadErrorState } from "../load-error-state";
import {
  formatCreated,
  isNewDashboard,
  latestActivity,
  type ActivityDates,
  type ActivityKind,
} from "./explorer-created";
import {
  EMPTY_SELECTION,
  nextSelection,
  type ExplorerSelection,
} from "./explorer-selection";
import ExplorerContextMenu from "./explorer-context-menu";
import ExplorerConfirmDialog from "./explorer-confirm-dialog";
import {
  buildMenuItems,
  pasteTargetOf,
  type ExplorerKeyCommand,
  type ExplorerMenuTarget,
} from "./explorer-menu-items";
import {
  useExplorerActions,
  type ExplorerActions,
} from "./use-explorer-actions";
import type {
  ExplorerFacets,
  ExplorerLayout,
  ExplorerSort,
} from "./explorer-tree.types";
import { useExplorerLayout } from "./explorer-store";
import { useExplorerServer, type ExplorerServer } from "./use-explorer-server";

interface OpenMenu {
  target: ExplorerMenuTarget;
  /** What the menu acts on. */
  ids: string[];
  x: number;
  y: number;
}

function runCommand(
  command: Exclude<ExplorerKeyCommand, "menu" | "deselect">,
  target: ExplorerMenuTarget,
  ids: string[],
  actions: ExplorerActions
): void {
  const { node } = target;
  if (!node) return;
  if (command === "copy") actions.copy(ids);
  if (command === "cut") actions.cut(ids);
  if (command === "paste") actions.paste(pasteTargetOf(target));
  if (command === "delete") actions.requestDelete(ids);
}

/** The selection if `id` is part of it, otherwise just `id`. */
function idsFor(selection: ExplorerSelection, id: string): string[] {
  return selection.ids.includes(id) ? selection.ids : [id];
}

/**
 * What an empty tree shows. After a successful load with nothing in it, a
 * button to create the first dashboard sits in the middle.
 */
function EmptyTree({
  message,
  createLabel,
  onCreate,
  createDisabled,
}: Readonly<{
  message: string;
  createLabel: string;
  onCreate?: () => void;
  createDisabled: boolean;
}>) {
  if (!onCreate) {
    return (
      <p className="px-3 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
        {message}
      </p>
    );
  }
  return (
    <div className="flex flex-col items-center gap-4 px-3 py-16 text-center">
      <HiOutlineViewGrid className="h-10 w-10 text-gray-300 dark:text-gray-600" />
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
      <button
        type="button"
        onClick={onCreate}
        disabled={createDisabled}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-800"
      >
        <HiPlus className="h-4 w-4" />
        {createLabel}
      </button>
    </div>
  );
}

/** What an empty view says: no match, an empty folder, or nothing yet. */
function emptyMessageKey(
  isSearching: boolean,
  folderId: string | null
): string {
  if (isSearching) return "noResults";
  return folderId === null ? "empty" : "emptyFolder";
}

/** How many cards "Recently opened" shows. */
const RECENT_CARDS = 12;

const ACTIVITY_ORDER: readonly ActivityKind[] = ["created", "opened", "edited"];

/** The date of one kind of activity; a first save is no edit. */
function activityDate(
  dates: ActivityDates,
  kind: ActivityKind
): string | undefined {
  if (kind === "created") return dates.createdAt;
  if (kind === "opened") return dates.openedAt;
  return dates.updatedAt === dates.createdAt ? undefined : dates.updatedAt;
}

/**
 * A card's date: the latest activity, by day, and every known one with its
 * hour for the tooltip.
 */
function cardActivity(
  dates: ActivityDates,
  label: (kind: ActivityKind, when: string) => string,
  lang: string | undefined
): CardActivity | null {
  const latest = latestActivity(dates);
  if (!latest) return null;
  const lines = ACTIVITY_ORDER.flatMap((kind) => {
    const full = formatCreated(activityDate(dates, kind), lang)?.full;
    return full ? [label(kind, full)] : [];
  });
  return {
    kind: latest.kind,
    label: label(latest.kind, formatCreated(latest.at, lang)?.short ?? ""),
    title: lines.join("\n"),
  };
}

/** The server's folders and placements, with the local items laid over. */
function mergeLayout(
  local: ExplorerLayout,
  server: Pick<ExplorerServer, "folders" | "placements">
): ExplorerLayout {
  return {
    ...local,
    folders: { ...server.folders, ...local.folders },
    placements: server.placements,
  };
}

/** The open folder, for the page to show in its header and breadcrumb. */
export interface ExplorerPageFolder {
  name: string;
  /** "3 items". */
  summary: string;
  /** Stands in for the page's breadcrumb: "Dashboards › Ops › Daily". */
  breadcrumb: ReactNode;
}

interface ExplorerPanelProps {
  /**
   * Puts the parts on the page: the "New" menu goes where the page wants it
   * (its header bar), the list under it. Inside a folder the page shows the
   * folder in its header instead of its own title, and its breadcrumb.
   */
  renderPage?: (parts: {
    newMenu: ReactNode;
    list: ReactNode;
    folder: ExplorerPageFolder | null;
  }) => ReactNode;
}

/** Without a page: the open folder's breadcrumb and name. */
function FolderHeading({ folder }: Readonly<{ folder: ExplorerPageFolder }>) {
  return (
    <div className="flex flex-col gap-2">
      {folder.breadcrumb}
      <h2 className="text-lg font-semibold">{folder.name}</h2>
    </div>
  );
}

export default function ExplorerPanel({
  dict,
  renderPage,
}: Readonly<PropsWithI18nDict<ExplorerPanelProps>>) {
  const [local, update] = useExplorerLayout();
  const server = useExplorerServer();
  const merge = useCallback(
    (next: ExplorerLayout) => mergeLayout(next, server),
    [server]
  );
  const layout = useMemo(() => merge(local), [merge, local]);
  const router = useRouter();
  const localize = useLocalizedHref();
  const lang = useParams<{ lang?: string }>()?.lang;
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const [selection, setSelection] =
    useState<ExplorerSelection>(EMPTY_SELECTION);
  const [draggingIds, setDraggingIds] = useState<string[] | null>(null);
  // undefined = not over anything; null = the top level.
  const [dropTargetId, setDropTargetId] = useState<string | null | undefined>(
    undefined
  );
  const activeHref = pathNameWithoutLanguage(pathname);

  const sources = server.sources;
  const [facets, setFacets] = useState<ExplorerFacets>(NO_FACETS);
  const [sort, setSort] = useState<ExplorerSort | null>(null);
  const [viewMode, setViewMode] = useExplorerViewMode();
  const [openParam, openFolderParam] = useOpenFolder();
  // Until the folders load, the one in the URL is taken on trust; after, one
  // that is gone (deleted, or a stale link) is the top level.
  const currentFolderId =
    openParam !== null && (server.isLoading || layout.folders[openParam])
      ? openParam
      : null;
  const path = useMemo(
    () => folderPath(layout, currentFolderId),
    [layout, currentFolderId]
  );
  /** The date picker reads its words from the whole dictionary. */
  const pickerDictionary = useMemo(() => ({ dashboard: dict }), [dict]);
  const tagOptions = useMemo(() => allTags(sources), [sources]);
  const tree = useMemo(
    () =>
      sortTree(
        buildTree(layout, sources, query, facets, currentFolderId),
        sort
      ),
    [layout, sources, query, facets, currentFolderId, sort]
  );
  const isSearching = query.trim().length > 0 || isFaceted(facets);
  const isCards = viewMode === "cards";
  // The cards show one level; while filtering, every match in the folder.
  const cardNodes = useMemo(
    () => sortNodes(isSearching ? flatMatches(tree, query) : tree, sort),
    [isSearching, tree, query, sort]
  );
  const everything = useMemo(
    () => nodesById(buildTree(layout, sources)),
    [layout, sources]
  );
  // Recently opened, at the top level only, and not while filtering.
  const recent = useMemo(() => {
    if (!isCards || isSearching || currentFolderId !== null) return [];
    return server.recent
      .flatMap(({ id }) => everything.get(id) ?? [])
      .slice(0, RECENT_CARDS);
  }, [isCards, isSearching, currentFolderId, server.recent, everything]);
  const openedAt = useMemo(
    () => new Map(server.recent.map((open) => [open.id, open.openedAt])),
    [server.recent]
  );
  /** Drops the search, so a new item is not hidden by it. */
  const clearQuery = useCallback(() => setQuery(""), []);
  const clearSelection = useCallback(() => setSelection(EMPTY_SELECTION), []);
  const openDashboard = useCallback(
    (id: string) => {
      setSelection({ ids: [id], anchorId: id });
      router.push(localize(id));
    },
    [router, localize]
  );
  const actions = useExplorerActions({
    layout,
    update,
    merge,
    sources,
    server,
    dict,
    onCreated: clearQuery,
    onDeleted: clearSelection,
    onOpen: openDashboard,
  });
  const isExpanded = useCallback(
    // Search results show every folder that leads to a match.
    (id: string) => isSearching || Boolean(layout.expanded[id]),
    [isSearching, layout.expanded]
  );
  const order = useMemo(
    () =>
      isCards
        ? cardNodes.map((node) => node.id)
        : visibleOrder(tree, isExpanded),
    [isCards, cardNodes, tree, isExpanded]
  );
  const openFolder = useCallback(
    (id: string | null) => {
      openFolderParam(id);
      setSelection(EMPTY_SELECTION);
      // A folder opened from search results shows all it holds.
      setQuery("");
    },
    [openFolderParam]
  );
  const { requestMove, rename, stopRename } = actions;
  const closeMenu = useCallback(() => setMenu(null), []);

  // Like a desktop: a click anywhere but on a row clears the selection. Not
  // while a menu or confirmation is open, since those act on the selection.
  const isBusy = menu !== null || actions.pending !== null;
  useEffect(() => {
    if (isBusy) return;
    const deselectOutside = (event: globalThis.MouseEvent) => {
      const target = event.target;
      // Rows, and the header's select-all box, act on the selection.
      const keeps = '[role="treeitem"], [data-keep-selection]';
      if (target instanceof Element && target.closest(keeps)) {
        return;
      }
      clearSelection();
    };
    document.addEventListener("mousedown", deselectOutside);
    return () => document.removeEventListener("mousedown", deselectOutside);
  }, [isBusy, clearSelection]);

  const handlers = useMemo<ExplorerNodeHandlers>(() => {
    const endDrag = () => {
      setDraggingIds(null);
      setDropTargetId(undefined);
    };
    /** Right-clicking or dragging outside the selection starts a new one. */
    const focusOn = (id: string) => {
      if (!selection.ids.includes(id))
        setSelection({ ids: [id], anchorId: id });
      return idsFor(selection, id);
    };
    return {
      onToggleFolder: (id) => update((current) => toggleFolder(current, id)),
      onOpenFolder: openFolder,
      onSelect: (id, mode) =>
        setSelection((current) => nextSelection(current, id, mode, order)),
      onRename: rename,
      onStopRename: stopRename,
      onDragStart: (id) => setDraggingIds(focusOn(id)),
      onDragEnd: endDrag,
      onDragOverTarget: setDropTargetId,
      onDropOn: (folderId) => {
        if (draggingIds) requestMove(draggingIds, folderId);
        endDrag();
      },
      onOpenMenu: (target, x, y) => {
        const ids = target.node ? focusOn(target.node.id) : [];
        setMenu({ target, ids, x, y });
      },
      onToggleStar: actions.toggleStar,
      onEditTags: actions.editTags,
      onCommand: (command, target) => {
        if (command === "deselect") clearSelection();
        else if (target.node) {
          runCommand(command, target, focusOn(target.node.id), actions);
        }
      },
    };
  }, [
    update,
    draggingIds,
    requestMove,
    actions,
    selection,
    order,
    clearSelection,
    rename,
    stopRename,
    openFolder,
  ]);

  const cutIds = actions.clipboard?.mode === "cut" ? actions.clipboard.ids : [];
  // "All" means every row in view: those inside closed folders are not.
  const selectedInView = order.filter((id) => selection.ids.includes(id));
  let selectAllState: SelectAllState["state"] = "none";
  if (order.length > 0 && selectedInView.length === order.length) {
    selectAllState = "all";
  } else if (selectedInView.length > 0) {
    selectAllState = "some";
  }
  const selectAll: SelectAllState = {
    state: selectAllState,
    onToggle: () =>
      setSelection(
        selectAllState === "all"
          ? EMPTY_SELECTION
          : { ids: [...order], anchorId: order[0] ?? null }
      ),
  };
  const t = (key: string) => trDynamic(`explorer.${key}`, dict);
  const view: ExplorerViewState = {
    isExpanded,
    activeHref,
    editingId: actions.editingId,
    isNamingNew: actions.isNamingNew,
    namePlaceholder: trDynamic("explorer.namePlaceholder", dict),
    isDragging: draggingIds !== null,
    dropTargetId,
    selectedIds: new Set(selection.ids),
    fadedIds: new Set([...(draggingIds ?? []), ...cutIds]),
    starLabels: { star: t("columns.star"), unstar: t("columns.unstar") },
    tagLabels: {
      edit: (name) => trDynamic("explorer.editTagsOf", dict, { name }),
      add: t("addTag"),
    },
    created: {
      format: (createdAt) => formatCreated(createdAt, lang),
      isNew: (createdAt) => isNewDashboard(createdAt),
      newLabel: t("columns.new"),
      unknownLabel: t("columns.createdUnknown"),
    },
    selectLabel: (name) => trDynamic("explorer.columns.select", dict, { name }),
    folder: {
      badge: t("columns.folder"),
      noDate: t("columns.folderNoDate"),
    },
    expandLabels: {
      expand: (name) => trDynamic("explorer.expandFolder", dict, { name }),
      collapse: (name) => trDynamic("explorer.collapseFolder", dict, { name }),
    },
  };
  const cardsView: ExplorerCardsView = {
    ...view,
    itemCount: (count) =>
      trDynamic(
        count === 1 ? "explorer.cards.oneItem" : "explorer.cards.items",
        dict,
        { count: String(count) }
      ),
    activity: (node) =>
      cardActivity(
        {
          createdAt: node.createdAt,
          openedAt: openedAt.get(node.id),
          updatedAt: node.updatedAt,
        },
        (kind, when) => trDynamic(`explorer.cards.${kind}`, dict, { when }),
        lang
      ),
    unknownActivity: t("columns.createdUnknown"),
  };
  const parentOfNode = (id: string) => parentOf(layout, id);
  // Creating needs the Editor role on the open folder.
  const canCreateHere =
    currentFolderId === null || actions.folderAllows(currentFolderId, "edit");

  const onRootDragOver = (event: DragEvent<HTMLElement>) => {
    if (draggingIds === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetId(currentFolderId);
  };

  const onRootDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    handlers.onDropOn(currentFolderId);
  };

  const onRootContextMenu = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    setMenu({
      target: { node: null, parentId: currentFolderId },
      ids: [],
      x: event.clientX,
      y: event.clientY,
    });
  };

  // As the other catalog pages put it: the toggle, then the main action.
  const newMenu = (
    <div className="flex shrink-0 items-center gap-2">
      <LayoutToggle
        layout={isCards ? "cards" : "list"}
        labels={{ cards: t("view.cards"), list: t("view.list") }}
        onLayout={(next) => setViewMode(next === "cards" ? "cards" : "list")}
      />
      <ExplorerNewMenu
        newLabel={t("new")}
        newFileLabel={t("newFile")}
        newFolderLabel={t("newFolder")}
        createDisabled={actions.isNamingNew || actions.busy || !canCreateHere}
        fileDisabled={!actions.canCreateFile}
        onNewFile={() => actions.createFile(currentFolderId)}
        onNewFolder={() => actions.createFolder(currentFolderId)}
      />
    </div>
  );
  const isEmpty = (isCards ? cardNodes : tree).length === 0;
  const emptyState = (
    <>
      {isEmpty && server.isLoading && !isCards && (
        <ExplorerSkeletonRows label={t("loading")} />
      )}
      {isEmpty && server.isLoading && isCards && (
        <ExplorerCardsSkeleton
          label={t("loading")}
          // "Recently opened" shows only at the top level, when not filtering.
          withRecent={!isSearching && currentFolderId === null}
        />
      )}
      {isEmpty && !server.isLoading && server.loadError && (
        <LoadErrorState
          title={t("loadError")}
          description={t("loadErrorBody")}
          retry={{ label: t("retry"), onRetry: server.refresh }}
        />
      )}
      {isEmpty && !server.isLoading && !server.loadError && (
        <EmptyTree
          message={t(emptyMessageKey(isSearching, currentFolderId))}
          createLabel={t("createFirst")}
          onCreate={
            isSearching ? undefined : () => actions.createFile(currentFolderId)
          }
          createDisabled={
            !actions.canCreateFile || actions.busy || !canCreateHere
          }
        />
      )}
    </>
  );
  // The folder above the open one, for its ".." row: the top level at first.
  const parentCrumb = path.at(-2) ?? { id: null, name: t("title") };
  const openFolderNode = currentFolderId
    ? everything.get(currentFolderId)
    : undefined;
  const folder: ExplorerPageFolder | null = openFolderNode
    ? {
        name: openFolderNode.name,
        summary: cardsView.itemCount(openFolderNode.children.length),
        breadcrumb: (
          <ExplorerBreadcrumb
            path={path}
            rootLabel={t("title")}
            rootIcon={<HiOutlineSquares2X2 className="mr-2 h-4 w-4" />}
            label={t("breadcrumb")}
            onOpen={openFolder}
            drop={
              draggingIds === null
                ? undefined
                : {
                    targetId: dropTargetId,
                    onOver: setDropTargetId,
                    onDrop: handlers.onDropOn,
                  }
            }
          />
        ),
      }
    : null;
  // The ".." that goes back up, in both views.
  const parentLink: ExplorerCardsParent = {
    label: trDynamic("explorer.parentFolder", dict, { name: parentCrumb.name }),
    onOpen: () => openFolder(parentCrumb.id),
    ...(draggingIds === null
      ? {}
      : {
          drop: {
            isTarget: dropTargetId === parentCrumb.id,
            onOver: () => setDropTargetId(parentCrumb.id),
            onDrop: () => handlers.onDropOn(parentCrumb.id),
          },
        }),
  };
  const cardsBody = (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <ExplorerFilterCard
        t={t}
        selectAll={selectAll}
        search={{ value: query, onChange: setQuery }}
        tags={tagOptions}
        facets={facets}
        onFacetsChange={setFacets}
        pickerDictionary={pickerDictionary}
        lang={lang}
        sort={sort}
        onSortChange={setSort}
      />
      <div
        data-testid="explorer-root"
        onDragOver={onRootDragOver}
        onDrop={onRootDrop}
        onContextMenu={onRootContextMenu}
        className={twMerge(
          // The padding keeps a selected card's ring from being clipped; the
          // margin takes it back, so the cards line up with the filters.
          "-m-1 min-h-48 flex-1 overflow-y-auto rounded-xl p-1",
          draggingIds !== null &&
            dropTargetId === currentFolderId &&
            "bg-primary-50/60 dark:bg-primary-900/20"
        )}
      >
        {(!isEmpty || folder) && (
          <ExplorerCards
            parent={folder ? parentLink : null}
            t={t}
            nodes={cardNodes}
            recent={recent}
            parentId={isSearching ? null : currentFolderId}
            parentOf={parentOfNode}
            view={cardsView}
            handlers={handlers}
          />
        )}
        {emptyState}
      </div>
    </div>
  );
  const listBody = (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        data-testid="explorer-root"
        onDragOver={onRootDragOver}
        onDrop={onRootDrop}
        onContextMenu={onRootContextMenu}
        className={twMerge(
          LIST_FRAME_CLASS,
          draggingIds !== null &&
            dropTargetId === currentFolderId &&
            "bg-primary-50/60 dark:bg-primary-900/20"
        )}
      >
        <ExplorerHeader
          selectAll={selectAll}
          search={{ value: query, onChange: setQuery }}
          pickerDictionary={pickerDictionary}
          t={t}
          tags={tagOptions}
          facets={facets}
          onFacetsChange={setFacets}
          sorting={{ sort, onSortChange: setSort }}
          lang={lang}
        />
        {(tree.length > 0 || folder) && (
          <ul role="tree" aria-label={t("title")} aria-multiselectable>
            {folder && (
              <ParentRow
                label={parentLink.label}
                onOpen={parentLink.onOpen}
                drop={parentLink.drop}
              />
            )}
            {tree.map((node) => (
              <ExplorerNode
                key={node.id}
                node={node}
                parentId={currentFolderId}
                view={view}
                handlers={handlers}
              />
            ))}
          </ul>
        )}
        {emptyState}
      </div>
    </div>
  );
  const list = (
    <>
      {isCards ? cardsBody : listBody}
      {menu && (
        <ExplorerContextMenu
          x={menu.x}
          y={menu.y}
          label={menu.target.node?.name ?? t("title")}
          items={buildMenuItems(menu.target, menu.ids, actions, t)}
          onClose={closeMenu}
        />
      )}
      {actions.tagsEditing && (
        <ExplorerTagsDialog
          key={actions.tagsEditing.id}
          title={trDynamic("explorer.tagsDialog.title", dict, {
            name: actions.tagsEditing.name,
          })}
          body={trDynamic("setup.tags.body", dict)}
          initialTags={actions.tagsEditing.tags}
          knownTags={tagOptions}
          t={(key, params) => trDynamic(`setup.tags.${key}`, dict, params)}
          saveLabel={t("tagsDialog.save")}
          cancelLabel={t("tagsDialog.cancel")}
          onSave={actions.saveTags}
          onCancel={actions.cancelTags}
        />
      )}
      {actions.permissionsEditing && (
        <ExplorerPermissionsDialog
          key={actions.permissionsEditing.id}
          folder={actions.permissionsEditing}
          load={server.folderPermissions}
          save={server.setFolderPermissions}
          onClose={actions.closePermissions}
          dict={dict}
        />
      )}
      <ExplorerConfirmDialog
        pending={actions.pending}
        onConfirm={actions.confirmPending}
        onCancel={actions.cancelPending}
        dict={dict}
      />
    </>
  );
  return renderPage ? (
    renderPage({ newMenu, list, folder })
  ) : (
    <>
      {folder && <FolderHeading folder={folder} />}
      {newMenu}
      {list}
    </>
  );
}
