"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  HiChevronRight,
  HiOutlineFolder,
  HiOutlineFolderOpen,
  HiOutlineStar,
  HiOutlineViewGrid,
  HiStar,
} from "react-icons/hi";
import { LuFolderUp } from "react-icons/lu";
import { twMerge } from "tailwind-merge";
import { useLocalizedHref } from "@/features/layout/hooks/use-localized-href";
import type { ExplorerTreeNode } from "./explorer-tree.types";
import {
  keyCommand,
  type ExplorerKeyCommand,
  type ExplorerMenuTarget,
} from "./explorer-menu-items";
import { selectModeOf, type SelectMode } from "./explorer-selection";
import {
  CELL_INSET_CLASS,
  COLUMN_CLASSES,
  FolderBadge,
  NewBadge,
  TagsButton,
} from "./explorer-columns";
import SelectBox from "@/features/common/components/select-box";
import type { CreatedFormat } from "./explorer-created";

/** Callbacks shared by every row; built once by the panel. */
export interface ExplorerNodeHandlers {
  onToggleFolder: (id: string) => void;
  /** Opens a folder: the explorer then shows what is inside it. */
  onOpenFolder: (id: string) => void;
  /** A click: plain, Ctrl/⌘ (toggle) or Shift (range). */
  onSelect: (id: string, mode: SelectMode) => void;
  onRename: (id: string, name: string) => void;
  onStopRename: () => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOverTarget: (folderId: string | null) => void;
  onDropOn: (folderId: string | null) => void;
  /** Right-click, or the menu key, at a viewport point. */
  onOpenMenu: (target: ExplorerMenuTarget, x: number, y: number) => void;
  /** A keyboard shortcut on a focused row. */
  /** Stars or unstars a dashboard for the signed-in user. */
  onToggleStar: (id: string) => void;
  /** Opens the tags dialog of a dashboard. */
  onEditTags: (id: string) => void;
  onCommand: (
    command: Exclude<ExplorerKeyCommand, "menu">,
    target: ExplorerMenuTarget
  ) => void;
}

/** What the tree needs to know to draw a row. */
export interface ExplorerViewState {
  isExpanded: (id: string) => boolean;
  activeHref: string;
  editingId: string | null;
  /** True while `editingId` is an item just created: its name box starts empty. */
  isNamingNew: boolean;
  /** Hint in a new item's empty name box. */
  namePlaceholder: string;
  isDragging: boolean;
  dropTargetId: string | null | undefined;
  selectedIds: ReadonlySet<string>;
  /** Items being dragged or waiting on the clipboard after a cut. */
  fadedIds: ReadonlySet<string>;
  starLabels: { star: string; unstar: string };
  /** The Tags cell's button: its name, and its text when there are none. */
  tagLabels: { edit: (name: string) => string; add: string };
  /** The Created column and the "New" badge. */
  created: {
    format: (createdAt: string | undefined) => CreatedFormat | null;
    isNew: (createdAt: string | undefined) => boolean;
    newLabel: string;
    unknownLabel: string;
  };
  /** The checkbox's label for a row, e.g. `Select "Fleet"`. */
  selectLabel: (name: string) => string;
  /** What a folder row shows in the dashboards' columns. */
  folder: { badge: string; noDate: string };
  /** The chevron's name: expand or collapse the folder in place. */
  expandLabels: {
    expand: (name: string) => string;
    collapse: (name: string) => string;
  };
}

interface ExplorerNodeProps {
  node: ExplorerTreeNode;
  parentId: string | null;
  view: ExplorerViewState;
  handlers: ExplorerNodeHandlers;
}

/** Every row starts this far from its list's left edge. */
const ROW_PADDING_PX = 12;
/**
 * How far each level sits to the right of its folder: up to the middle of
 * the folder's chevron, where the guide line runs down beside its contents.
 */
const NEST_INDENT_PX = ROW_PADDING_PX + 8;
/**
 * Dashboards have no chevron: their icon (and checkbox) takes the chevron's
 * place, so inside a folder they sit right next to its guide line.
 */
const FILE_PADDING_PX = ROW_PADDING_PX;

/**
 * The name box. A new item's box starts empty; leaving it empty keeps the
 * default name the item was created with ("Untitled file"), since an empty
 * rename is ignored.
 */
export function RenameInput({
  node,
  startEmpty,
  placeholder,
  handlers,
}: Readonly<{
  node: ExplorerTreeNode;
  startEmpty: boolean;
  placeholder: string;
  handlers: ExplorerNodeHandlers;
}>) {
  const commit = (value: string) => {
    handlers.onRename(node.id, value);
    handlers.onStopRename();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") commit(event.currentTarget.value);
    if (event.key === "Escape") handlers.onStopRename();
  };
  const field = useRef<HTMLInputElement>(null);
  // Focus lands on a row the user just created or double-clicked.
  useEffect(() => field.current?.focus(), []);
  return (
    <input
      ref={field}
      defaultValue={startEmpty ? "" : node.name}
      placeholder={startEmpty ? placeholder : undefined}
      aria-label={node.name}
      onFocus={(event) => {
        // Caret at the end of the name, not the whole name highlighted.
        const end = event.currentTarget.value.length;
        event.currentTarget.setSelectionRange(end, end);
      }}
      onKeyDown={onKeyDown}
      onBlur={(event) => commit(event.currentTarget.value)}
      className={twMerge(
        // Bare text with a caret: no box, ring or background.
        "m-0 h-5 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm shadow-none",
        "text-gray-900 caret-blue-600 outline-none ring-0",
        "focus:border-0 focus:shadow-none focus:outline-none focus:ring-0",
        "placeholder:text-gray-400 dark:text-white dark:caret-blue-400",
        "dark:placeholder:text-gray-500"
      )}
    />
  );
}

/** Routes a row's shortcut to the panel; typing in the rename box is left alone. */
export function handleRowKey(
  event: KeyboardEvent<HTMLElement>,
  target: ExplorerMenuTarget,
  handlers: ExplorerNodeHandlers
): void {
  if (event.target instanceof HTMLInputElement) return;
  const command = keyCommand(event);
  if (!command) return;
  event.preventDefault();
  // Nested rows bubble through their parent folder's row.
  event.stopPropagation();
  if (command === "menu") {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    handlers.onOpenMenu(target, rect.left + 24, rect.bottom);
    return;
  }
  handlers.onCommand(command, target);
}

/**
 * The row's icon, which turns into a checkbox on hover, and stays one while
 * the row is selected. Ticking it adds or removes the row from the selection.
 */
function RowMarker({
  icon,
  selected,
  label,
  onToggle,
}: Readonly<{
  icon: ReactNode;
  selected: boolean;
  label: string;
  onToggle: () => void;
}>) {
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
      <span
        className={twMerge("flex", selected ? "hidden" : "group-hover:hidden")}
      >
        {icon}
      </span>
      <span className={selected ? "flex" : "hidden group-hover:flex"}>
        <SelectBox checked={selected} label={label} onToggle={onToggle} />
      </span>
    </span>
  );
}

export function StarButton({
  starred,
  labels,
  onToggle,
}: Readonly<{
  starred: boolean;
  labels: { star: string; unstar: string };
  onToggle: () => void;
}>) {
  const Icon = starred ? HiStar : HiOutlineStar;
  return (
    <button
      type="button"
      aria-pressed={starred}
      aria-label={starred ? labels.unstar : labels.star}
      title={starred ? labels.unstar : labels.star}
      onClick={onToggle}
      className={twMerge(
        "flex h-7 w-7 items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-700",
        starred
          ? "text-amber-500"
          : "text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/** The dashboard's name, with a "New" badge right after it while it is new. */
function DashboardName({
  name,
  badge,
}: Readonly<{ name: string; badge: string | null }>) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span className="min-w-0 truncate">{name}</span>
      {badge !== null && <NewBadge label={badge} />}
    </span>
  );
}

/**
 * A folder's Tags, Created and Star cells: a "Folder" badge and a dash, so
 * the row is not left blank where its dashboards show values. Folders have
 * no tags, creation date or star.
 */
function FolderCells({
  folder,
}: Readonly<{ folder: ExplorerViewState["folder"] }>) {
  return (
    <>
      <div className={twMerge(COLUMN_CLASSES.tags, CELL_INSET_CLASS)}>
        <FolderBadge label={folder.badge} />
      </div>
      <div className={twMerge(COLUMN_CLASSES.created, CELL_INSET_CLASS)}>
        <span
          aria-hidden
          title={folder.noDate}
          className="text-gray-400 dark:text-gray-500"
        >
          —
        </span>
      </div>
      <div className={COLUMN_CLASSES.star} />
    </>
  );
}

function CreatedCell({
  createdAt,
  created,
}: Readonly<{
  createdAt: string | undefined;
  created: ExplorerViewState["created"];
}>) {
  const formatted = created.format(createdAt);
  if (formatted === null) {
    return (
      <span
        title={created.unknownLabel}
        className="text-gray-400 dark:text-gray-500"
      >
        —
      </span>
    );
  }
  return (
    <time
      dateTime={createdAt}
      title={formatted.full}
      className="truncate text-gray-500 dark:text-gray-400"
    >
      {formatted.short}
    </time>
  );
}

/** "active" is the dashboard open right now; "selected" is part of the selection. */
type RowTone = "active" | "selected" | "plain";

const TONE_CLASSES: Record<RowTone, string> = {
  active:
    "bg-blue-50 text-blue-900 hover:bg-blue-50 dark:bg-blue-900/40 dark:text-white dark:hover:bg-blue-900/40",
  selected:
    "bg-gray-200 text-gray-900 hover:bg-gray-200 dark:bg-gray-700/70 dark:text-white dark:hover:bg-gray-700/70",
  plain: "",
};

function rowTone(isActive: boolean, isSelected: boolean): RowTone {
  if (isActive) return "active";
  if (isSelected) return "selected";
  return "plain";
}

function rowClassName(tone: RowTone, isDropTarget: boolean, isFaded: boolean) {
  return twMerge(
    "flex h-10 w-full select-none items-center gap-3 pr-3 text-left text-sm transition-colors",
    "text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800/70",
    TONE_CLASSES[tone],
    isDropTarget &&
      "bg-primary-50 ring-1 ring-inset ring-primary-400 dark:bg-primary-900/40",
    isFaded && "opacity-40"
  );
}

/** The drag, drop and right-click wiring of a row. */
function rowDragProps(
  node: ExplorerTreeNode,
  parentId: string | null,
  view: ExplorerViewState,
  handlers: ExplorerNodeHandlers
) {
  // Dropping on a file drops into the folder that holds it.
  const dropFolderId = node.kind === "folder" ? node.id : parentId;
  const target: ExplorerMenuTarget = { node, parentId };
  return {
    draggable: view.editingId !== node.id,
    onDragStart: (event: DragEvent<HTMLElement>) => {
      event.stopPropagation();
      event.dataTransfer.effectAllowed = "move";
      // Firefox only starts a drag that carries data.
      event.dataTransfer.setData("text/plain", node.id);
      handlers.onDragStart(node.id);
    },
    onDragEnd: handlers.onDragEnd,
    onContextMenu: (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      handlers.onOpenMenu(target, event.clientX, event.clientY);
    },
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!view.isDragging) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      handlers.onDragOverTarget(dropFolderId);
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      handlers.onDropOn(dropFolderId);
    },
  };
}

/** What every kind of row shares, worked out once by `ExplorerNode`. */
interface RowProps {
  node: ExplorerTreeNode;
  parentId: string | null;
  view: ExplorerViewState;
  handlers: ExplorerNodeHandlers;
  isSelected: boolean;
  isEditing: boolean;
  className: string;
  dragProps: ReturnType<typeof rowDragProps>;
  onKeyDown: (event: KeyboardEvent<HTMLLIElement>) => void;
  /** The name, or its rename box while it is being renamed. */
  label: ReactNode;
  toggleSelected: () => void;
}

/** The name as the row's button: a native one, so it takes focus and keys. */
const NAME_BUTTON_CLASS =
  "flex min-w-0 flex-1 cursor-pointer items-center self-stretch text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500";

/**
 * A folder. A plain click on its name opens it (the list then shows what is
 * inside it) and leaves the selection alone, which the checkbox is for;
 * Ctrl/⌘ and Shift still build a selection. The chevron, or Space on the
 * name, expands it in place.
 */
function FolderRow({
  node,
  view,
  handlers,
  isSelected,
  isEditing,
  className,
  dragProps,
  onKeyDown,
  label,
  toggleSelected,
}: Readonly<RowProps>) {
  const isExpanded = view.isExpanded(node.id);
  const FolderIcon = isExpanded ? HiOutlineFolderOpen : HiOutlineFolder;
  const expandLabel = isExpanded
    ? view.expandLabels.collapse(node.name)
    : view.expandLabels.expand(node.name);
  const onNameClick = (event: MouseEvent<HTMLElement>) => {
    const mode = selectModeOf(event);
    if (mode === "single") handlers.onOpenFolder(node.id);
    else handlers.onSelect(node.id, mode);
  };
  const onNameKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== " ") return;
    event.preventDefault();
    handlers.onToggleFolder(node.id);
  };
  return (
    <li
      role="treeitem"
      aria-expanded={isExpanded}
      aria-selected={isSelected}
      onKeyDown={onKeyDown}
    >
      <div
        {...dragProps}
        style={{ paddingLeft: ROW_PADDING_PX }}
        className={twMerge(className, "group")}
      >
        <button
          type="button"
          aria-label={expandLabel}
          aria-expanded={isExpanded}
          title={expandLabel}
          onClick={() => handlers.onToggleFolder(node.id)}
          className="-m-1 flex shrink-0 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        >
          <HiChevronRight
            className={twMerge(
              "h-4 w-4 transition-transform",
              isExpanded && "rotate-90"
            )}
          />
        </button>
        <RowMarker
          icon={
            <FolderIcon className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
          }
          selected={isSelected}
          label={view.selectLabel(node.name)}
          onToggle={toggleSelected}
        />
        {isEditing ? (
          label
        ) : (
          <button
            type="button"
            onClick={onNameClick}
            onKeyDown={onNameKeyDown}
            className={NAME_BUTTON_CLASS}
          >
            {label}
          </button>
        )}
        <FolderCells folder={view.folder} />
      </div>
      {isExpanded && node.children.length > 0 && (
        // The left border is the guide from the folder down to its last
        // item, so it is clear what sits inside it.
        <ul
          style={{ marginLeft: NEST_INDENT_PX }}
          className="border-l border-gray-200 dark:border-gray-700"
        >
          {node.children.map((child) => (
            <ExplorerNode
              key={child.id}
              node={child}
              parentId={node.id}
              view={view}
              handlers={handlers}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** A saved dashboard: its name is the link that opens it. */
function DashboardRow({
  node,
  view,
  handlers,
  isSelected,
  isEditing,
  className,
  dragProps,
  onKeyDown,
  label,
  toggleSelected,
}: Readonly<RowProps>) {
  const localize = useLocalizedHref();
  const isActive = view.activeHref === node.href;
  const onLinkClick = (event: MouseEvent<HTMLElement>) => {
    const mode = selectModeOf(event);
    if (mode === "single") return;
    // Instead of opening a tab or a window.
    event.preventDefault();
    handlers.onSelect(node.id, mode);
  };
  return (
    <li role="treeitem" aria-selected={isSelected} onKeyDown={onKeyDown}>
      {/* The row drags as a whole; the link only opens the dashboard. */}
      <div
        {...dragProps}
        style={{ paddingLeft: FILE_PADDING_PX }}
        className={twMerge(className, "group")}
      >
        <RowMarker
          icon={
            <HiOutlineViewGrid
              className={twMerge(
                "h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400",
                isActive && "text-blue-600 dark:text-blue-300"
              )}
            />
          }
          selected={isSelected}
          label={view.selectLabel(node.name)}
          onToggle={toggleSelected}
        />
        {isEditing ? (
          // Outside the link, so clicking into the box doesn't open it.
          <div className="flex min-w-0 flex-1 items-center self-stretch">
            {label}
          </div>
        ) : (
          <Link
            draggable={false}
            href={localize(node.href ?? "")}
            onClick={onLinkClick}
            className="flex min-w-0 flex-1 items-center self-stretch"
          >
            <DashboardName
              name={node.name}
              badge={
                view.created.isNew(node.createdAt)
                  ? view.created.newLabel
                  : null
              }
            />
          </Link>
        )}
        <div className={twMerge(COLUMN_CLASSES.tags, CELL_INSET_CLASS)}>
          <TagsButton
            tags={node.tags ?? []}
            label={view.tagLabels.edit(node.name)}
            addLabel={view.tagLabels.add}
            onEdit={() => handlers.onEditTags(node.id)}
          />
        </div>
        <div className={twMerge(COLUMN_CLASSES.created, CELL_INSET_CLASS)}>
          <CreatedCell createdAt={node.createdAt} created={view.created} />
        </div>
        <div className={COLUMN_CLASSES.star}>
          <StarButton
            starred={node.starred === true}
            labels={view.starLabels}
            onToggle={() => handlers.onToggleStar(node.id)}
          />
        </div>
      </div>
    </li>
  );
}

/** A dashboard not saved yet: its name only selects it. */
function DraftRow({
  node,
  handlers,
  view,
  isSelected,
  isEditing,
  className,
  dragProps,
  onKeyDown,
  label,
  toggleSelected,
}: Readonly<RowProps>) {
  return (
    <li role="treeitem" aria-selected={isSelected} onKeyDown={onKeyDown}>
      <div
        {...dragProps}
        style={{ paddingLeft: FILE_PADDING_PX }}
        className={twMerge(className, "group")}
      >
        <RowMarker
          icon={
            <HiOutlineViewGrid className="h-4 w-4 shrink-0 text-gray-400" />
          }
          selected={isSelected}
          label={view.selectLabel(node.name)}
          onToggle={toggleSelected}
        />
        {isEditing ? (
          label
        ) : (
          <button
            type="button"
            onClick={(event) => handlers.onSelect(node.id, selectModeOf(event))}
            className={NAME_BUTTON_CLASS}
          >
            {label}
          </button>
        )}
      </div>
    </li>
  );
}

export default function ExplorerNode({
  node,
  parentId,
  view,
  handlers,
}: Readonly<ExplorerNodeProps>) {
  const isEditing = view.editingId === node.id;
  const isSelected = view.selectedIds.has(node.id);
  const isActive = Boolean(node.href) && view.activeHref === node.href;
  const isDropTarget =
    view.isDragging && node.kind === "folder" && view.dropTargetId === node.id;
  const target: ExplorerMenuTarget = { node, parentId };
  const row: RowProps = {
    node,
    parentId,
    view,
    handlers,
    isSelected,
    isEditing,
    className: rowClassName(
      rowTone(isActive, isSelected),
      isDropTarget,
      view.fadedIds.has(node.id)
    ),
    dragProps: rowDragProps(node, parentId, view, handlers),
    onKeyDown: (event) => handleRowKey(event, target, handlers),
    label: isEditing ? (
      <RenameInput
        node={node}
        startEmpty={view.isNamingNew}
        placeholder={view.namePlaceholder}
        handlers={handlers}
      />
    ) : (
      <span className="min-w-0 flex-1 truncate">{node.name}</span>
    ),
    toggleSelected: () => handlers.onSelect(node.id, "toggle"),
  };
  if (node.kind === "folder") return <FolderRow {...row} />;
  if (node.href) return <DashboardRow {...row} />;
  return <DraftRow {...row} />;
}

/**
 * The first row inside a folder, "..": opens the folder above it, or the top
 * level, as in a file archiver. Items dropped on it move up there.
 */
export function ParentRow({
  label,
  onOpen,
  drop,
}: Readonly<{
  /** "Up to Ops", for screen readers and the tooltip. */
  label: string;
  onOpen: () => void;
  /** Set while items are dragged. */
  drop?: { isTarget: boolean; onOver: () => void; onDrop: () => void };
}>) {
  return (
    <li role="treeitem" aria-selected={false}>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={onOpen}
        onDragOver={(event) => {
          if (!drop) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "move";
          drop.onOver();
        }}
        onDrop={(event) => {
          if (!drop) return;
          event.preventDefault();
          event.stopPropagation();
          drop.onDrop();
        }}
        style={{ paddingLeft: ROW_PADDING_PX }}
        className={twMerge(
          rowClassName("plain", drop?.isTarget === true, false),
          "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
        )}
      >
        <LuFolderUp
          aria-hidden
          className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400"
        />
        <span className="font-medium tracking-widest text-gray-600 dark:text-gray-300">
          ..
        </span>
      </button>
    </li>
  );
}
