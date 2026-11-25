"use client";

/**
 * The explorer as cards, Google Drive style: the filters in a card of their
 * own, the dashboards opened lately in a row of small cards, then everything
 * in the open folder, folders first as tiles and dashboards as larger cards.
 *
 * A card does what a row of the list does: a click opens it (a folder opens
 * in place, a dashboard in its page), Ctrl/⌘ and Shift build a selection, it
 * drags into folders and the breadcrumb, and it has the same right-click menu
 * and shortcuts. The arrow keys move between cards.
 */
import Link from "next/link";
import {
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { IconType } from "react-icons";
import { LuFolderUp } from "react-icons/lu";
import {
  HiOutlineCalendar,
  HiOutlineEye,
  HiOutlineFolder,
  HiOutlinePencil,
  HiOutlineStar,
  HiOutlineViewGrid,
  HiStar,
} from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useLocalizedHref } from "@/features/layout/hooks/use-localized-href";
import type {
  ExplorerFacets,
  ExplorerSort,
  ExplorerTreeNode,
} from "./explorer-tree.types";
import type { ActivityKind } from "./explorer-created";
import type { ExplorerMenuTarget } from "./explorer-menu-items";
import { selectModeOf } from "./explorer-selection";
import SelectBox from "@/features/common/components/select-box";
import InteractiveCard, {
  INTERACTIVE_CARD_TARGET,
} from "@/features/common/components/interactive-card/interactive-card";
import {
  CAPSULE_ACTIVE_CLASS,
  CAPSULE_CLASS,
  CreatedFilter,
  NameSearch,
  NewBadge,
  SortButton,
  TagFilter,
  type SelectAllState,
} from "./explorer-columns";
import {
  handleRowKey,
  RenameInput,
  StarButton,
  type ExplorerNodeHandlers,
  type ExplorerViewState,
} from "./explorer-node";

/** What the cards need besides the list's view state. */
export interface ExplorerCardsView extends ExplorerViewState {
  /** "3 items", for a folder's tile. */
  itemCount: (count: number) => string;
  /**
   * The one date a dashboard's card shows, the latest of its creation, the
   * viewer's last open and its last edit, with all three in `title`.
   */
  activity: (node: ExplorerTreeNode) => CardActivity | null;
  /** Shown instead of a date when none is known. */
  unknownActivity: string;
}

export interface CardActivity {
  kind: ActivityKind;
  /** "Edited Nov 23, 2026": the day, not the hour. */
  label: string;
  /** Every known date, one per line, with the hour. */
  title: string;
}

const ACTIVITY_ICONS: Record<ActivityKind, IconType> = {
  created: HiOutlineCalendar,
  opened: HiOutlineEye,
  edited: HiOutlinePencil,
};

/** The card's date, on the left of the line under its name. */
function ActivityDate({
  activity,
  unknown,
}: Readonly<{ activity: CardActivity | null; unknown: string }>) {
  if (!activity) {
    return (
      <span
        title={unknown}
        className="shrink-0 text-[11px] text-gray-500 dark:text-gray-400"
      >
        —
      </span>
    );
  }
  const Icon = ACTIVITY_ICONS[activity.kind];
  return (
    <span
      title={activity.title}
      data-activity={activity.kind}
      className="flex shrink-0 items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400"
    >
      <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />
      <span className="whitespace-nowrap">{activity.label}</span>
    </span>
  );
}

/** The cards' grid: as many 14rem columns as fit. */
const CARD_GRID = "grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]";

/** Every card the arrow keys move between, in a section. */
const CARD_SELECTOR = "[data-explorer-card]";

/**
 * The card the arrow key points to: the next or previous one in reading
 * order for left and right, the closest one in the row above or below for
 * up and down, as laid out on screen.
 */
function cardInDirection(
  cards: readonly HTMLElement[],
  from: HTMLElement,
  key: string
): HTMLElement | undefined {
  const index = cards.indexOf(from);
  if (key === "ArrowRight") return cards[index + 1];
  if (key === "ArrowLeft") return cards[index - 1];
  if (key === "Home") return cards[0];
  if (key === "End") return cards.at(-1);
  const box = from.getBoundingClientRect();
  const down = key === "ArrowDown";
  const rows = cards.filter((card) => {
    const top = card.getBoundingClientRect().top;
    return down ? top > box.top + 1 : top < box.top - 1;
  });
  if (rows.length === 0) return undefined;
  const nearestTop = down
    ? Math.min(...rows.map((card) => card.getBoundingClientRect().top))
    : Math.max(...rows.map((card) => card.getBoundingClientRect().top));
  const row = rows.filter(
    (card) => Math.abs(card.getBoundingClientRect().top - nearestTop) < 1
  );
  const center = box.left + box.width / 2;
  return row.reduce((best, card) => {
    const distance = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return Math.abs(r.left + r.width / 2 - center);
    };
    return distance(card) < distance(best) ? card : best;
  });
}

const ARROW_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);

/** Moves the focus between the section's cards with the arrow keys. */
function onSectionKeyDown(event: KeyboardEvent<HTMLElement>) {
  if (!ARROW_KEYS.has(event.key)) return;
  if (event.target instanceof HTMLInputElement) return;
  const from = (event.target as HTMLElement).closest<HTMLElement>(
    CARD_SELECTOR
  );
  if (!from) return;
  const cards = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(CARD_SELECTOR),
  ];
  const next = cardInDirection(cards, from, event.key);
  if (!next) return;
  event.preventDefault();
  next.focus();
}

/** The drag, drop and right-click wiring every card shares. */
function cardEvents(
  node: ExplorerTreeNode,
  parentId: string | null,
  view: ExplorerViewState,
  handlers: ExplorerNodeHandlers
) {
  const target: ExplorerMenuTarget = { node, parentId };
  const isEditing = view.editingId === node.id;
  // Dropping on a dashboard drops into the folder that holds it.
  const dropFolderId = node.kind === "folder" ? node.id : parentId;
  return {
    draggable: !isEditing,
    onDragStart: (event: DragEvent<HTMLElement>) => {
      event.stopPropagation();
      event.dataTransfer.effectAllowed = "move";
      // Firefox only starts a drag that carries data.
      event.dataTransfer.setData("text/plain", node.id);
      handlers.onDragStart(node.id);
    },
    onDragEnd: handlers.onDragEnd,
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
    onContextMenu: (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      handlers.onOpenMenu(target, event.clientX, event.clientY);
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) =>
      handleRowKey(event, target, handlers),
  };
}

/** The card's checkbox: on the left, on hover and always once selected. */
function cardSelection(
  node: ExplorerTreeNode,
  view: ExplorerViewState,
  handlers: ExplorerNodeHandlers
) {
  return {
    checked: view.selectedIds.has(node.id),
    label: view.selectLabel(node.name),
    onToggle: () => handlers.onSelect(node.id, "toggle"),
  };
}

/** A folder, as a tile: its icon, its name and how much it holds. */
function FolderCard({
  node,
  parentId,
  view,
  handlers,
}: Readonly<{
  node: ExplorerTreeNode;
  parentId: string | null;
  view: ExplorerCardsView;
  handlers: ExplorerNodeHandlers;
}>) {
  const isEditing = view.editingId === node.id;
  const onClick = (event: MouseEvent<HTMLElement>) => {
    if (isEditing) return;
    const mode = selectModeOf(event);
    if (mode === "single") handlers.onOpenFolder(node.id);
    else handlers.onSelect(node.id, mode);
  };
  return (
    <InteractiveCard
      as="li"
      layout="row"
      aria-label={node.name}
      data-keep-selection
      {...cardEvents(node, parentId, view, handlers)}
      selected={view.selectedIds.has(node.id)}
      dropTarget={view.isDragging && view.dropTargetId === node.id}
      faded={view.fadedIds.has(node.id)}
      selection={cardSelection(node, view, handlers)}
    >
      <div
        role="button"
        tabIndex={0}
        data-explorer-card
        onClick={onClick}
        onKeyDown={(event) => {
          if (isEditing || event.key !== "Enter") return;
          if (event.target !== event.currentTarget) return;
          event.preventDefault();
          handlers.onOpenFolder(node.id);
        }}
        className={twMerge(
          "flex min-w-0 flex-1 cursor-pointer select-none items-center gap-3 text-left",
          // While renaming, the input must take the clicks.
          !isEditing && INTERACTIVE_CARD_TARGET
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">
          <HiOutlineFolder aria-hidden className="h-5 w-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          {isEditing ? (
            <RenameInput
              node={node}
              startEmpty={view.isNamingNew}
              placeholder={view.namePlaceholder}
              handlers={handlers}
            />
          ) : (
            <span className="truncate text-[13px] font-medium text-gray-900 dark:text-white">
              {node.name}
            </span>
          )}
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {view.itemCount(node.children.length)}
          </span>
        </span>
      </div>
    </InteractiveCard>
  );
}

/** The way back up when inside a folder, as the list's ".." row. */
export interface ExplorerCardsParent {
  /** 'Up to "Ops"', for screen readers and the tooltip. */
  label: string;
  onOpen: () => void;
  /** Set while items are dragged. */
  drop?: { isTarget: boolean; onOver: () => void; onDrop: () => void };
}

/**
 * The ".." card, first among the dashboards and shaped like them: it opens
 * the folder above, and takes what is dropped on it there.
 */
function ParentCard({ parent }: Readonly<{ parent: ExplorerCardsParent }>) {
  const { drop } = parent;
  return (
    <InteractiveCard
      as="li"
      aria-label={parent.label}
      dropTarget={drop?.isTarget === true}
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
    >
      {/* One area, the card's full height: the icon with ".." under it. */}
      <span
        role="button"
        tabIndex={0}
        aria-label={parent.label}
        title={parent.label}
        data-explorer-card
        onClick={parent.onOpen}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          parent.onOpen();
        }}
        className={twMerge(
          "flex min-h-40 flex-1 cursor-pointer select-none flex-col items-center justify-center gap-2.5 text-gray-400 dark:text-gray-500",
          INTERACTIVE_CARD_TARGET
        )}
      >
        <LuFolderUp aria-hidden className="h-10 w-10" />
        {/* "..", drawn: two dots in the icon's colour, sized to its stroke. */}
        <span aria-hidden className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      </span>
    </InteractiveCard>
  );
}

/** A dashboard not saved yet, while it is being named. */
function DraftCard({
  node,
  view,
  handlers,
}: Readonly<{
  node: ExplorerTreeNode;
  view: ExplorerCardsView;
  handlers: ExplorerNodeHandlers;
}>) {
  return (
    <InteractiveCard
      as="li"
      aria-label={node.name}
      data-keep-selection
      media={<CardPreview />}
    >
      <div className="flex h-12 items-center px-3">
        {view.editingId === node.id ? (
          <RenameInput
            node={node}
            startEmpty={view.isNamingNew}
            placeholder={view.namePlaceholder}
            handlers={handlers}
          />
        ) : (
          <span className="truncate text-[13px] text-gray-500">
            {node.name}
          </span>
        )}
      </div>
    </InteractiveCard>
  );
}

/** The top of a dashboard's card: its icon on a shaded panel. */
function CardPreview() {
  return (
    <span
      aria-hidden
      className="flex h-28 w-full items-center justify-center bg-gray-50 text-gray-400 dark:bg-gray-900/40 dark:text-gray-500"
    >
      <HiOutlineViewGrid className="h-10 w-10" />
    </span>
  );
}

/** A dashboard: its preview, name, "New" badge, date and star. */
function DashboardCard({
  node,
  parentId,
  view,
  handlers,
  recent,
}: Readonly<{
  node: ExplorerTreeNode;
  parentId: string | null;
  view: ExplorerCardsView;
  handlers: ExplorerNodeHandlers;
  /** On a recent card: no checkbox; a click always opens it. */
  recent?: boolean;
}>) {
  const localize = useLocalizedHref();
  const isEditing = view.editingId === node.id;
  const onLinkClick = (event: MouseEvent<HTMLElement>) => {
    const mode = selectModeOf(event);
    if (mode === "single" || recent) return;
    // Instead of opening a tab or a window.
    event.preventDefault();
    handlers.onSelect(node.id, mode);
  };
  return (
    <InteractiveCard
      as="li"
      aria-label={node.name}
      data-keep-selection
      {...cardEvents(node, parentId, view, handlers)}
      selected={!recent && view.selectedIds.has(node.id)}
      faded={view.fadedIds.has(node.id)}
      selection={recent ? undefined : cardSelection(node, view, handlers)}
      actions={
        <StarButton
          starred={node.starred === true}
          labels={view.starLabels}
          onToggle={() => handlers.onToggleStar(node.id)}
        />
      }
      media={<CardPreview />}
    >
      {isEditing ? (
        <div className="flex h-12 items-center px-3">
          <RenameInput
            node={node}
            startEmpty={view.isNamingNew}
            placeholder={view.namePlaceholder}
            handlers={handlers}
          />
        </div>
      ) : (
        <span className="flex flex-col px-3 py-2.5">
          {/* The name is the link and covers the whole card, so a click
              anywhere opens it, except on the checkbox and the star. */}
          <Link
            draggable={false}
            href={localize(node.href ?? "")}
            onClick={onLinkClick}
            data-explorer-card
            className={twMerge("min-w-0", INTERACTIVE_CARD_TARGET)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 truncate text-[13px] font-medium text-gray-900 dark:text-white">
                {node.name}
              </span>
              {view.created.isNew(node.createdAt) && (
                <NewBadge label={view.created.newLabel} />
              )}
            </span>
          </Link>
          <span className="flex min-h-5 min-w-0 items-center">
            <ActivityDate
              activity={view.activity(node)}
              unknown={view.unknownActivity}
            />
          </span>
        </span>
      )}
    </InteractiveCard>
  );
}

function CardFor({
  node,
  parentId,
  view,
  handlers,
}: Readonly<{
  node: ExplorerTreeNode;
  parentId: string | null;
  view: ExplorerCardsView;
  handlers: ExplorerNodeHandlers;
}>) {
  if (node.kind === "folder") {
    return (
      <FolderCard
        node={node}
        parentId={parentId}
        view={view}
        handlers={handlers}
      />
    );
  }
  if (!node.href) {
    return <DraftCard node={node} view={view} handlers={handlers} />;
  }
  return (
    <DashboardCard
      node={node}
      parentId={parentId}
      view={view}
      handlers={handlers}
    />
  );
}

/**
 * Keeps a grid to the one row it fits: as many items as it has columns,
 * measured from the grid itself, so it follows the window's width. Until it
 * can measure (or where it can't, as in tests), it shows them all.
 */
function useOneRow<T>(items: readonly T[]) {
  const ref = useRef<HTMLUListElement>(null);
  const [columns, setColumns] = useState<number | null>(null);
  useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    const measure = () => {
      // With auto-fill, the computed value lists every column, empty or not.
      const tracks = getComputedStyle(grid).gridTemplateColumns.trim();
      const known = tracks !== "" && tracks !== "none" && !tracks.includes("(");
      setColumns(known ? tracks.split(/\s+/).length : null);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);
  const shown = columns === null ? items : items.slice(0, columns);
  return [ref, shown] as const;
}

/** The dashboards opened lately, in one row. */
function RecentCards({
  recent,
  parentOf,
  view,
  handlers,
}: Readonly<{
  recent: readonly ExplorerTreeNode[];
  parentOf: (id: string) => string | null;
  view: ExplorerCardsView;
  handlers: ExplorerNodeHandlers;
}>) {
  const [ref, shown] = useOneRow(recent);
  return (
    <ul ref={ref} className={`${CARD_GRID} gap-4`}>
      {shown.map((node) => (
        <DashboardCard
          key={node.id}
          node={node}
          parentId={parentOf(node.id)}
          view={view}
          handlers={handlers}
          recent
        />
      ))}
    </ul>
  );
}

function Section({
  title,
  children,
}: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {title}
      </h2>
      <div onKeyDown={onSectionKeyDown} className="flex flex-col gap-3">
        {children}
      </div>
    </section>
  );
}

/** The filters, as a card above the cards rather than column headers. */
export function ExplorerFilterCard({
  t,
  selectAll,
  search,
  tags,
  facets,
  onFacetsChange,
  pickerDictionary,
  sort,
  onSortChange,
  lang,
}: Readonly<{
  t: (key: string) => string;
  /** The page's language, for the Created filter's range. */
  lang?: string;
  selectAll: SelectAllState;
  search: { value: string; onChange: (value: string) => void };
  tags: readonly string[];
  facets: ExplorerFacets;
  onFacetsChange: (next: ExplorerFacets) => void;
  pickerDictionary: I18nRecord;
  /** The cards' order, from the arrows left of Name and Created. */
  sort: ExplorerSort | null;
  onSortChange: (next: ExplorerSort | null) => void;
}>) {
  const StarIcon = facets.starredOnly ? HiStar : HiOutlineStar;
  return (
    <div
      role="search"
      aria-label={t("cards.filters")}
      // The list header's spacing: 40px tall around 28px pills, 12px in from
      // the sides and between controls.
      className="flex min-h-10 flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <span data-keep-selection className="flex">
        <SelectBox
          checked={
            selectAll.state === "some" ? "mixed" : selectAll.state === "all"
          }
          label={t("columns.selectAll")}
          onToggle={selectAll.onToggle}
        />
      </span>
      <div className="flex min-w-48 flex-1">
        <NameSearch
          t={t}
          value={search.value}
          onChange={search.onChange}
          placeholder={t("nameSearch")}
          leading={
            <SortButton
              t={t}
              sortKey="name"
              sort={sort}
              onSortChange={onSortChange}
            />
          }
        />
      </div>
      <div className="w-full sm:w-56">
        <TagFilter
          t={t}
          tags={tags}
          facets={facets}
          onFacetsChange={onFacetsChange}
        />
      </div>
      <div className="w-full sm:w-44">
        <CreatedFilter
          t={t}
          lang={lang}
          dictionary={pickerDictionary}
          facets={facets}
          onFacetsChange={onFacetsChange}
          leading={
            <SortButton
              t={t}
              sortKey="created"
              sort={sort}
              onSortChange={onSortChange}
            />
          }
        />
      </div>
      <button
        type="button"
        aria-pressed={facets.starredOnly}
        onClick={() =>
          onFacetsChange({ ...facets, starredOnly: !facets.starredOnly })
        }
        className={twMerge(
          CAPSULE_CLASS,
          "flex items-center gap-1.5 pl-3 pr-2.5",
          facets.starredOnly && CAPSULE_ACTIVE_CLASS
        )}
      >
        {t("cards.starredOnly")}
        <StarIcon
          aria-hidden
          className={twMerge(
            "h-4 w-4",
            facets.starredOnly ? "text-amber-500" : "text-gray-500"
          )}
        />
      </button>
    </div>
  );
}

interface ExplorerCardsProps {
  t: (key: string) => string;
  /** What the open folder holds, or every match while filtering. */
  nodes: readonly ExplorerTreeNode[];
  /** The dashboards opened lately; shown only when not empty. */
  recent: readonly ExplorerTreeNode[];
  /** The open folder; null at the top level. */
  parentId: string | null;
  /** While filtering the cards come from several folders. */
  parentOf: (id: string) => string | null;
  view: ExplorerCardsView;
  handlers: ExplorerNodeHandlers;
  /** Inside a folder: the ".." tile that goes back up, shown first. */
  parent?: ExplorerCardsParent | null;
}

export default function ExplorerCards({
  t,
  nodes,
  recent,
  parentId,
  parentOf,
  view,
  handlers,
  parent,
}: Readonly<ExplorerCardsProps>) {
  const folders = nodes.filter((node) => node.kind === "folder");
  const files = nodes.filter((node) => node.kind === "file");
  return (
    <div className="flex flex-col gap-6">
      {recent.length > 0 && (
        <Section title={t("cards.recent")}>
          <RecentCards
            recent={recent}
            parentOf={parentOf}
            view={view}
            handlers={handlers}
          />
        </Section>
      )}
      {(nodes.length > 0 || parent) && (
        <Section title={t("cards.all")}>
          {folders.length > 0 && (
            <ul
              aria-label={t("cards.folders")}
              className={`${CARD_GRID} gap-3`}
            >
              {folders.map((node) => (
                <CardFor
                  key={node.id}
                  node={node}
                  parentId={parentId ?? parentOf(node.id)}
                  view={view}
                  handlers={handlers}
                />
              ))}
            </ul>
          )}
          {(files.length > 0 || parent) && (
            <ul
              aria-label={t("cards.dashboards")}
              className={`${CARD_GRID} gap-4`}
            >
              {parent && <ParentCard parent={parent} />}
              {files.map((node) => (
                <CardFor
                  key={node.id}
                  node={node}
                  parentId={parentOf(node.id)}
                  view={view}
                  handlers={handlers}
                />
              ))}
            </ul>
          )}
        </Section>
      )}
    </div>
  );
}

const SKELETON_BAR = "animate-pulse rounded bg-gray-200 dark:bg-gray-700";

/** A section's title, as a bar. */
function SkeletonHeading({ width }: Readonly<{ width: string }>) {
  return <div className={`h-3.5 ${width} ${SKELETON_BAR}`} />;
}

/** A dashboard card, as bars: the preview, the name and the date. */
function SkeletonDashboardCard({ nameWidth }: Readonly<{ nameWidth: string }>) {
  return (
    <li className="flex flex-col rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="h-28 animate-pulse rounded-t-[11px] bg-gray-100 dark:bg-gray-900/40" />
      <div className="flex flex-col gap-2 px-3 py-3">
        <div className={`h-3.5 ${nameWidth} ${SKELETON_BAR}`} />
        <div className={`h-3 w-1/3 ${SKELETON_BAR}`} />
      </div>
    </li>
  );
}

/** A folder tile, as bars: the icon, the name and the count. */
function SkeletonFolderCard({ nameWidth }: Readonly<{ nameWidth: string }>) {
  return (
    <li className="flex h-16 items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="h-4 w-4 shrink-0" />
      <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-900/40" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className={`h-3.5 ${nameWidth} ${SKELETON_BAR}`} />
        <div className={`h-3 w-12 ${SKELETON_BAR}`} />
      </div>
    </li>
  );
}

/** Name widths, so the cards don't look stamped out. */
const RECENT_WIDTHS = [
  "w-2/3",
  "w-1/2",
  "w-3/5",
  "w-2/5",
  "w-3/4",
  "w-1/2",
  "w-2/3",
  "w-3/5",
];
const FOLDER_WIDTHS = ["w-1/2", "w-2/3", "w-2/5"];
const FILE_WIDTHS = ["w-3/5", "w-2/3", "w-1/2", "w-3/4", "w-2/5", "w-3/5"];

/** The recent cards' placeholders, in one row like the real ones. */
function SkeletonRecentRow() {
  const [ref, shown] = useOneRow(RECENT_WIDTHS);
  return (
    <ul ref={ref} className={`${CARD_GRID} gap-4`}>
      {shown.map((width, i) => (
        <SkeletonDashboardCard key={`r${i}`} nameWidth={width} />
      ))}
    </ul>
  );
}

/**
 * The cards' shape while the dashboards load, laid out like the real view:
 * "Recently opened" (only where it shows, at the top level), then "All" with
 * the folder tiles before the dashboard cards.
 */
export function ExplorerCardsSkeleton({
  label,
  withRecent,
}: Readonly<{ label: string; withRecent: boolean }>) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div aria-hidden className="flex flex-col gap-6">
        {withRecent && (
          <div data-skeleton-section="recent" className="flex flex-col gap-3">
            <SkeletonHeading width="w-28" />
            <SkeletonRecentRow />
          </div>
        )}
        <div data-skeleton-section="all" className="flex flex-col gap-3">
          <SkeletonHeading width="w-12" />
          <ul className={`${CARD_GRID} gap-3`}>
            {FOLDER_WIDTHS.map((width, i) => (
              <SkeletonFolderCard key={`d${i}`} nameWidth={width} />
            ))}
          </ul>
          <ul className={`${CARD_GRID} gap-4`}>
            {FILE_WIDTHS.map((width, i) => (
              <SkeletonDashboardCard key={`f${i}`} nameWidth={width} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
