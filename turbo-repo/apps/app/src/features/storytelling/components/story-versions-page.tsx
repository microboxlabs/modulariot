"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Dropdown, DropdownItem } from "flowbite-react";
import {
  HiArrowLeft,
  HiArrowPath,
  HiArrowTopRightOnSquare,
  HiEllipsisVertical,
  HiMinus,
  HiPlus,
  HiSparkles,
  HiTrash,
} from "react-icons/hi2";
import { MdGpsFixed } from "react-icons/md";
import { toast } from "sonner";
import { ClientBreadcrumb } from "@/features/common/components/Breadcrumb/ClientBreadcrumb";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import { SectionHeader } from "@/features/layout/components/section-header/section-header";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { avatarTint, initials } from "../story-share-store";
import { getStory } from "../storytelling-store";
import { versionChildren, type StoryVersion } from "../story-versions";
import { StoryVersionDeleteDialog } from "./story-version-delete-dialog";
import {
  deleteStoryVersion,
  getStoryVersionState,
  iterateVersion,
  setCurrentVersion,
} from "../story-versions-store";

interface StoryVersionsPageProps {
  readonly dict: I18nRecord;
  readonly id: string;
  /** Full root dictionary — only to satisfy SectionHeader's filter-bar slot,
   * same as the detail route. */
  readonly rootDict: I18nRecord;
}

const LINE = "bg-gray-300 dark:bg-gray-600";
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 1.25;

/** Which slice of the horizontal "bus" a child cell draws — the connector
 * spans between the first and last child's centres. */
function busClass(index: number, count: number): string {
  if (count <= 1) return "before:hidden";
  if (index === 0) return "before:left-1/2 before:right-0";
  if (index === count - 1) return "before:left-0 before:right-1/2";
  return "before:left-0 before:right-0";
}

interface NodeActions {
  readonly onOpen: (version: StoryVersion) => void;
  readonly onIterate: (version: StoryVersion) => void;
  readonly onDelete: (version: StoryVersion) => void;
}

function VersionCard({
  version,
  isCurrent,
  locale,
  dict,
  actions,
}: {
  readonly version: StoryVersion;
  readonly isCurrent: boolean;
  readonly locale: string;
  readonly dict: I18nRecord;
  readonly actions: NodeActions;
}) {
  return (
    <div
      data-version-node
      className={`group relative w-60 overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md dark:bg-gray-800 ${
        isCurrent
          ? "border-blue-500 ring-1 ring-blue-500"
          : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-500"
      }`}
    >
      {/* Whole-card open target — a real <button> stretched over the card
          (kept below the kebab via z-index), same stacked-link idea as
          story-card.tsx. */}
      <button
        type="button"
        onClick={() => actions.onOpen(version)}
        aria-label={`${tr("version.menu.open", dict)} ${tr("version.badgeLabel", dict, {
          label: version.label,
        })}`}
        className="absolute inset-0 z-0 cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      />

      {/* Title row — same treatment as the stories' section header. */}
      <div className="flex items-center gap-1.5 border-b border-gray-100 px-3 py-1.5 dark:border-gray-700">
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {tr("version.badgeLabel", dict, { label: version.label })}
        </span>
        {isCurrent && (
          <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {tr("version.current", dict)}
          </span>
        )}
        {!isCurrent && version.parentId === null && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {tr("version.root", dict)}
          </span>
        )}

        <div className="relative z-10 ml-auto">
          <Dropdown
            inline
            arrowIcon={false}
            label=""
            placement="bottom-end"
            // Only fade — no transform transition. This menu lives inside the
            // canvas's scale() wrapper, so animating `transform` would fight
            // floating-ui's positioning transform and make the panel fly in
            // from 0,0.
            className="w-40 transition-opacity duration-150 ease-out starting:opacity-0"
            renderTrigger={() => (
              <button
                type="button"
                aria-label={tr("version.menu.label", dict)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                <HiEllipsisVertical className="h-4 w-4" />
              </button>
            )}
          >
            <DropdownItem
              icon={HiArrowTopRightOnSquare}
              onClick={() => actions.onOpen(version)}
            >
              {tr("version.menu.open", dict)}
            </DropdownItem>
            <DropdownItem icon={HiArrowPath} onClick={() => actions.onIterate(version)}>
              {tr("version.menu.iterate", dict)}
            </DropdownItem>
            {version.parentId !== null && (
              <DropdownItem
                icon={HiTrash}
                onClick={() => actions.onDelete(version)}
                className="text-red-600 dark:text-red-400"
              >
                {tr("version.menu.delete", dict)}
              </DropdownItem>
            )}
          </Dropdown>
        </div>
      </div>

      <div className="px-3 py-2.5">
        <p className="text-xs text-gray-600 dark:text-gray-300">{version.summary}</p>
        <div className="mt-2.5 flex items-center gap-1.5">
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold ${avatarTint(
              version.createdBy
            )}`}
          >
            {initials(version.createdBy)}
          </span>
          <span className="min-w-0 truncate text-[11px] text-gray-400 dark:text-gray-500">
            {version.createdBy} · {formatDateString(version.createdAt, "date", locale)}
          </span>
        </div>
      </div>
    </div>
  );
}

/** One node and the subtree above it — the tree grows upward: a node's card
 * sits at the bottom, its children fan out above it, joined by an
 * org-chart-style bus connector. */
function VersionSubtree({
  node,
  childrenByParent,
  currentId,
  locale,
  dict,
  actions,
}: {
  readonly node: StoryVersion;
  readonly childrenByParent: Map<string | null, StoryVersion[]>;
  readonly currentId: string;
  readonly locale: string;
  readonly dict: I18nRecord;
  readonly actions: NodeActions;
}) {
  const kids = [...(childrenByParent.get(node.id) ?? [])].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );

  return (
    <div className="flex flex-col-reverse items-center">
      <VersionCard
        version={node}
        isCurrent={node.id === currentId}
        locale={locale}
        dict={dict}
        actions={actions}
      />

      {kids.length > 0 && <div className={`h-10 w-px ${LINE}`} />}

      {kids.length > 0 && (
        <div className="flex items-end">
          {kids.map((kid, i) => (
            <div
              key={kid.id}
              className={`relative flex flex-col items-center px-5 pb-10 after:absolute after:bottom-0 after:left-1/2 after:h-10 after:w-px after:-translate-x-1/2 after:bg-gray-300 after:content-[''] before:absolute before:bottom-0 before:h-px before:bg-gray-300 before:content-[''] dark:after:bg-gray-600 dark:before:bg-gray-600 ${busClass(
                i,
                kids.length
              )}`}
            >
              <VersionSubtree
                node={kid}
                childrenByParent={childrenByParent}
                currentId={currentId}
                locale={locale}
                dict={dict}
                actions={actions}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export default function StoryVersionsPage({ dict, id, rootDict }: StoryVersionsPageProps) {
  const { lang } = useParams<{ lang: string }>();
  const router = useRouter();
  const [story] = useState(() => getStory(id));
  const locale = lang === "en" ? "en-US" : "es-CL";

  const viewportRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);

  // Canvas view — pan offset (x, y) plus scale, as one atom so zoom-toward-
  // point can update both together.
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [dragging, setDragging] = useState(false);

  // Bumped after an iterate/delete so the store is re-read.
  const [nonce, setNonce] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<StoryVersion | null>(null);

  const { versions, current, roots } = useMemo(() => {
    if (!story) {
      return { versions: [] as StoryVersion[], current: null, roots: [] as StoryVersion[] };
    }
    const state = getStoryVersionState(story);
    return {
      versions: state.versions,
      current: state.current,
      roots: versionChildren(state.versions).get(null) ?? [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, nonce]);

  const childrenByParent = useMemo(() => versionChildren(versions), [versions]);

  const fitAll = useCallback(() => {
    const vp = viewportRef.current;
    const tree = treeRef.current;
    if (!vp || !tree) return;
    const pad = 40;
    const w = tree.offsetWidth;
    const h = tree.offsetHeight;
    if (w === 0 || h === 0) return;
    const zoom = clamp(
      Math.min((vp.clientWidth - pad * 2) / w, (vp.clientHeight - pad * 2) / h),
      MIN_ZOOM,
      1.4
    );
    setView({
      zoom,
      x: (vp.clientWidth - w * zoom) / 2,
      y: (vp.clientHeight - h * zoom) / 2,
    });
  }, []);

  // Fit whenever the tree's node count changes (initial load + iterate/delete).
  useEffect(() => {
    const t = window.setTimeout(fitAll, 0);
    return () => window.clearTimeout(t);
  }, [fitAll, versions.length]);

  const zoomToward = useCallback((factor: number, px: number, py: number) => {
    setView((v) => {
      const zoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      return {
        zoom,
        x: px - ((px - v.x) / v.zoom) * zoom,
        y: py - ((py - v.y) / v.zoom) * zoom,
      };
    });
  }, []);

  const zoomFromCenter = useCallback(
    (factor: number) => {
      const vp = viewportRef.current;
      if (!vp) return;
      zoomToward(factor, vp.clientWidth / 2, vp.clientHeight / 2);
    },
    [zoomToward]
  );

  // Native (non-passive) wheel listener so zoom can preventDefault the page
  // scroll — React's onWheel is passive.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      zoomToward(
        e.deltaY < 0 ? 1.1 : 1 / 1.1,
        e.clientX - rect.left,
        e.clientY - rect.top
      );
    };
    vp.addEventListener("wheel", handler, { passive: false });
    return () => vp.removeEventListener("wheel", handler);
  }, [zoomToward]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // Nodes handle their own clicks — pan only from empty canvas.
    if ((e.target as HTMLElement).closest("[data-version-node]")) return;
    const v = viewRef.current;
    dragOriginRef.current = { x: e.clientX - v.x, y: e.clientY - v.y };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const origin = dragOriginRef.current;
    if (!origin) return;
    setView((v) => ({ ...v, x: e.clientX - origin.x, y: e.clientY - origin.y }));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragOriginRef.current) return;
    dragOriginRef.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  }, []);

  const actions = useMemo<NodeActions>(
    () => ({
      onOpen: (version) => {
        if (!story) return;
        setCurrentVersion(story, version.id);
        router.push(`/${lang}/storytelling/${encodeURIComponent(story.id)}`);
      },
      onIterate: (version) => {
        if (!story) return;
        const created = iterateVersion(story, version.id);
        toast.success(tr("version.toast.iterated", dict, { label: created.label }));
        setNonce((n) => n + 1);
      },
      onDelete: (version) => setPendingDelete(version),
    }),
    [story, lang, router, dict]
  );

  const confirmDelete = useCallback(() => {
    if (!story || !pendingDelete) return;
    deleteStoryVersion(story, pendingDelete.id);
    toast.success(tr("version.toast.deleted", dict, { label: pendingDelete.label }));
    setPendingDelete(null);
    setNonce((n) => n + 1);
  }, [story, pendingDelete, dict]);

  if (!story) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold text-gray-900 dark:text-white">
          {tr("detail.notFound.title", dict)}
        </p>
        <Link
          href={`/${lang}/storytelling`}
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          <HiArrowLeft className="h-4 w-4" />
          {tr("detail.notFound.backButton", dict)}
        </Link>
      </div>
    );
  }

  const ctrlBtn =
    "flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200";

  return (
    <div className="animate-story-enter flex h-full w-full flex-col">
      <SectionHeader
        filterDict={rootDict}
        leftContent={
          <ClientBreadcrumb
            dict={(dict?.breadcrumb as I18nRecord) ?? {}}
            rootIcon={<HiSparkles className="mr-2 h-4 w-4" />}
            path={[
              { label: "storytelling", href: "/storytelling" },
              { label: story.title, href: `/storytelling/${encodeURIComponent(story.id)}` },
              { label: "versions" },
            ]}
          />
        }
      />

      {/* Thin title bar — matches the section header's own strip. */}
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-2.5 dark:border-gray-700">
        <h1 className="text-sm font-semibold text-gray-900 dark:text-white">
          {tr("version.title", dict)}
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {tr("version.subtitle", dict, {
            count: String(versions.length),
            label: current?.label ?? "—",
          })}
        </p>
      </div>

      {/* Canvas */}
      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        className={`relative min-h-0 flex-1 touch-none overflow-hidden overscroll-contain bg-gray-50 dark:bg-gray-900 ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          backgroundImage:
            "radial-gradient(circle, rgb(128 128 128 / 0.18) 1px, transparent 1px)",
          backgroundSize: `${22 * view.zoom}px ${22 * view.zoom}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
      >
        <div
          className="absolute top-0 left-0 origin-top-left select-none"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
        >
          <div ref={treeRef} className="inline-flex items-end gap-12 p-12">
            {roots.map((root) => (
              <VersionSubtree
                key={root.id}
                node={root}
                childrenByParent={childrenByParent}
                currentId={current?.id ?? ""}
                locale={locale}
                dict={dict}
                actions={actions}
              />
            ))}
          </div>
        </div>

        {/* Controls — bottom right. stopPropagation so a click here doesn't
            also start a canvas pan. */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute right-4 bottom-4 flex items-center gap-1 rounded-xl border border-gray-200 bg-white/95 p-1 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-800/95"
        >
          <button
            type="button"
            onClick={fitAll}
            title={tr("version.canvas.fit", dict)}
            aria-label={tr("version.canvas.fit", dict)}
            className={ctrlBtn}
          >
            <MdGpsFixed className="h-4 w-4" />
          </button>
          <span className="mx-0.5 h-5 w-px bg-gray-200 dark:bg-gray-600" />
          <button
            type="button"
            onClick={() => zoomFromCenter(1 / ZOOM_STEP)}
            disabled={view.zoom <= MIN_ZOOM}
            title={tr("version.canvas.zoomOut", dict)}
            aria-label={tr("version.canvas.zoomOut", dict)}
            className={`${ctrlBtn} disabled:opacity-30 disabled:hover:bg-transparent`}
          >
            <HiMinus className="h-4 w-4" />
          </button>
          <span className="min-w-11 text-center text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
            {Math.round(view.zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => zoomFromCenter(ZOOM_STEP)}
            disabled={view.zoom >= MAX_ZOOM}
            title={tr("version.canvas.zoomIn", dict)}
            aria-label={tr("version.canvas.zoomIn", dict)}
            className={`${ctrlBtn} disabled:opacity-30 disabled:hover:bg-transparent`}
          >
            <HiPlus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <StoryVersionDeleteDialog
        version={pendingDelete}
        hasBranch={
          pendingDelete
            ? (childrenByParent.get(pendingDelete.id)?.length ?? 0) > 0
            : false
        }
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        dict={dict}
      />
    </div>
  );
}
