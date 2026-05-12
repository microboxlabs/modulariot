"use client";

import { Button, Dropdown, DropdownItem } from "flowbite-react";
import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  HiChevronDown,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiXMark,
  HiCheck,
  HiArrowDownTray,
  HiShare,
  HiPencilSquare,
  HiMagnifyingGlass,
  HiLink,
  HiEnvelope,
  HiArrowTopRightOnSquare,
  HiTrash,
} from "react-icons/hi2";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { getCategories } from "./clasification-form";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import { AlfrescoFileEntry } from "./image.types";
import { ReviewStatus } from "./media-row";
import { downloadImage } from "@/features/geographic-view/utils/download-image";
import { toast } from "sonner";
import { HiPrinter } from "react-icons/hi";

export type MediaViewerItem = {
  type: "image" | "document";
  file: AlfrescoFileEntry;
  refreshKey?: number;
};

type PermitLevel = "read" | "edit";
type PermitEntry = { id: string; displayName: string; level: PermitLevel };

export default function MediaInlineViewer({
  items,
  initialIndex = 0,
  onClose,
  reviewStatuses,
  draftDecisions,
  onStatusChange,
  onEdit,
  dictionary,
}: {
  items: MediaViewerItem[];
  initialIndex?: number;
  onClose: () => void;
  reviewStatuses?: Map<string, ReviewStatus>;
  draftDecisions?: Map<string, ReviewStatus>;
  onStatusChange?: (id: string, status: ReviewStatus) => void;
  onEdit?: (index: number) => void;
  dictionary: I18nRecord;
}) {
  const [currentIndex, setCurrentIndex] = useState(
    Math.max(0, Math.min(initialIndex, items.length - 1))
  );
  const [docBlobUrls, setDocBlobUrls] = useState<Record<string, string>>({});
  const [loadingDocs, setLoadingDocs] = useState<Set<string>>(new Set());
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsEditingName(false);
    setEditedName(items[currentIndex]?.file?.entry?.name ?? "");
  }, [currentIndex, items]);

  useEffect(() => {
    if (isEditingName) nameInputRef.current?.select();
  }, [isEditingName]);
  const [shareOpen, setShareOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!shareOpen) return;
    const handler = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [shareOpen]);

  useEffect(() => {
    setCurrentIndex(Math.max(0, Math.min(initialIndex, items.length - 1)));
  }, [initialIndex, items.length]);

  const current = items[currentIndex];
  const id = current?.file?.entry?.id;

  // Fetch PDF blob when navigating to a document
  useEffect(() => {
    if (!current || current.type !== "document" || !id) return;
    if (docBlobUrls[id] || loadingDocs.has(id)) return;

    setLoadingDocs((prev) => new Set(prev).add(id));
    fetch(`/app/api/bento/content?nodeId=${id}`)
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        setDocBlobUrls((prev) => ({ ...prev, [id]: url }));
      })
      .catch(() => {})
      .finally(() => {
        setLoadingDocs((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      });
  }, [current, id, docBlobUrls, loadingDocs]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(docBlobUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) return null;

  const categories = getCategories(dictionary);
  const tag = current.file.entry.properties["mintral:contentType"];
  const categoryLabel = categories[tag as keyof typeof categories]?.label;
  const status: ReviewStatus = id ? (reviewStatuses?.get(id) ?? "pending") : "pending";

  const handleDecision = (decision: ReviewStatus) => {
    if (!id) return;
    onStatusChange?.(id, decision);

    const updatedDrafts = new Map(draftDecisions ?? new Map());
    updatedDrafts.set(id, decision);

    const findNextUndecided = (): number | null => {
      for (let i = currentIndex + 1; i < items.length; i++) {
        const itemId = items[i]?.file?.entry?.id;
        if (!itemId) continue;
        if (updatedDrafts.has(itemId)) continue;
        if ((reviewStatuses?.get(itemId) ?? "pending") === "approved") continue;
        return i;
      }
      for (let i = 0; i < currentIndex; i++) {
        const itemId = items[i]?.file?.entry?.id;
        if (!itemId) continue;
        if (updatedDrafts.has(itemId)) continue;
        if ((reviewStatuses?.get(itemId) ?? "pending") === "approved") continue;
        return i;
      }
      return null;
    };

    const nextIndex = findNextUndecided();
    if (nextIndex !== null) {
      setCurrentIndex(nextIndex);
    } else {
      onClose();
    }
  };

  const fileUrl = id ? `/app/api/bento/content?nodeId=${id}` : "";
  const fullUrl = id ? `${window.location.origin}${fileUrl}` : "";

  const shareCopyLink = async () => {
    await navigator.clipboard.writeText(fullUrl);
    toast.success("Link copied to clipboard");
    setShareOpen(false);
  };

  const shareByEmail = () => {
    const subject = encodeURIComponent(current.file.entry.name);
    const body = encodeURIComponent(`${current.file.entry.name}\n\n${fullUrl}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
    setShareOpen(false);
  };

  const shareOpenTab = () => {
    window.open(fileUrl, "_blank");
    setShareOpen(false);
  };

  const handleDownload = () => {
    if (!id) return;
    const url = `/app/api/bento/content?nodeId=${id}`;
    downloadImage(url, dictionary).catch(() => {});
  };

  const imageUrl =
    current.type === "image"
      ? `/app/api/bento/content?nodeId=${id}${current.refreshKey ? `&r=${current.refreshKey}` : ""}`
      : null;
  const docUrl = current.type === "document" && id ? docBlobUrls[id] : null;
  const isDocLoading =
    current.type === "document" && id ? loadingDocs.has(id) : false;

  return (
    <div className="flex flex-col w-full h-full bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
        {/* Left: file metadata */}
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") setIsEditingName(false);
              }}
              className="text-sm font-medium text-gray-900 dark:text-white bg-transparent border-b border-blue-500 dark:border-blue-400 outline-none min-w-0 w-48 max-w-full"
            />
          ) : (
            <span
              title="Click to rename"
              onClick={() => setIsEditingName(true)}
              className="text-sm font-medium text-gray-900 dark:text-white truncate cursor-text hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {editedName || current.file.entry.name}
            </span>
          )}
          {categoryLabel && (
            <span className="text-xs text-gray-500 dark:text-gray-400 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 shrink-0 hidden sm:inline-block">
              {categoryLabel}
            </span>
          )}
          {current.file.entry.modifiedAt && (
            <span className="text-xs text-gray-500 dark:text-gray-400 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 shrink-0 hidden md:inline-block">
              {formatDateString(current.file.entry.modifiedAt)}
            </span>
          )}
          {current.file.entry.modifiedByUser?.id && (
            <span className="text-xs text-gray-500 dark:text-gray-400 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 shrink-0 hidden md:inline-block">
              {current.file.entry.modifiedByUser.id}
            </span>
          )}
          <span
            className={`text-xs rounded-full px-2 py-0.5 shrink-0 font-medium ${
              status === "approved"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : status === "rejected"
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
            }`}
          >
            {status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Pending"}
          </span>
          {id && draftDecisions?.has(id) && (
            <span className={`text-xs rounded-full px-2 py-0.5 shrink-0 font-medium border ${
              draftDecisions.get(id) === "approved"
                ? "border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                : "border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
            }`}>
              → {draftDecisions.get(id) === "approved" ? "Approve" : "Reject"}
            </span>
          )}
        </div>

        {/* Right: actions + counter + nav + approve/close */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Share popover */}
          <div ref={shareRef} className="relative">
            <button
              type="button"
              title="Share"
              onClick={() => setShareOpen((p) => !p)}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <HiShare className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            {shareOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
                <button
                  type="button"
                  onClick={shareCopyLink}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                >
                  <HiLink className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  Copy link
                </button>
                <button
                  type="button"
                  onClick={shareByEmail}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                >
                  <HiEnvelope className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  Share via email
                </button>
                <button
                  type="button"
                  onClick={shareOpenTab}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                >
                  <HiArrowTopRightOnSquare className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  Open in new tab
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            title="Download"
            onClick={handleDownload}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          >
            <HiArrowDownTray className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          {onEdit && (
            <button
              type="button"
              title="Replace file"
              onClick={() => onEdit(currentIndex)}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <HiPencilSquare className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          )}
          <button
            type="button"
            title="Delete"
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700 transition-colors cursor-pointer group"
          >
            <HiTrash className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
          </button>

          <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-0.5" />

          {/* Navigation with counter in the middle */}
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous"
          >
            <HiOutlineChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums px-1 min-w-10 text-center">
            {currentIndex + 1}/{items.length}
          </span>
          <button
            type="button"
            disabled={currentIndex === items.length - 1}
            onClick={() => setCurrentIndex((i) => Math.min(items.length - 1, i + 1))}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Next"
          >
            <HiOutlineChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>

          {/* Approve / Reject */}
          {(() => {
            const draft = id ? (draftDecisions?.get(id) ?? null) : null;
            return (
              <ReviewSplitButton
                primary={{
                  label: "Approve",
                  icon: <HiCheck className="w-4 h-4" />,
                  onClick: () => handleDecision("approved"),
                  isActive: draft === "approved",
                }}
                secondaryActions={[
                  {
                    label: "Reject",
                    icon: <HiXMark className="w-4 h-4" />,
                    onClick: () => handleDecision("rejected"),
                    isActive: draft === "rejected",
                  },
                  {
                    label: "Test",
                    icon: <HiPrinter className="w-4 h-4" />,
                    onClick: () => console.log("Test action"),
                    isActive: draft === "rejected",
                  },
                ]}
              />
            );
          })()}

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0 ml-1 cursor-pointer"
            aria-label="Close viewer"
          >
            <HiXMark className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Media area */}
        <div className="flex-1 min-w-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 overflow-hidden">
          {current.type === "image" && imageUrl && (
            <img
              src={imageUrl}
              alt={current.file.entry.name}
              className="max-w-full max-h-full object-contain"
            />
          )}
          {current.type === "document" &&
            (isDocLoading ? (
              <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading document...</span>
              </div>
            ) : docUrl ? (
              <iframe
                src={docUrl}
                title={current.file.entry.name}
                className="w-full h-full border-0"
              />
            ) : (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Unable to load document
              </span>
            ))}
        </div>

        {/* Metadata sidebar */}
        <div
          className="shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto flex flex-col"
          style={{ width: "33.333%" }}
        >
          <SidebarSection title="Properties" defaultExpanded>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <MetaRow label="Name" value={current.file.entry.name} />
              {categoryLabel && <MetaRow label="Category" value={categoryLabel} />}
              {current.file.entry.properties["cm:versionLabel"] && (
                <MetaRow label="Version" value={`v${current.file.entry.properties["cm:versionLabel"]}`} />
              )}
              <MetaRow label="Type" value={current.file.entry.content.mimeTypeName ?? current.file.entry.content.mimeType} />
              <MetaRow label="Size" value={formatBytes(current.file.entry.content.sizeInBytes)} />
              {current.file.entry.modifiedAt && (
                <MetaRow label="Modified" value={formatDateString(current.file.entry.modifiedAt)} />
              )}
              {current.file.entry.modifiedByUser?.displayName && (
                <MetaRow label="Modified by" value={current.file.entry.modifiedByUser.displayName} />
              )}
              {current.file.entry.createdAt && (
                <MetaRow label="Created" value={formatDateString(current.file.entry.createdAt)} />
              )}
              {current.file.entry.createdByUser?.displayName && (
                <MetaRow label="Author" value={current.file.entry.createdByUser.displayName} />
              )}
            </dl>
          </SidebarSection>
          <SidebarSection title="Permits">
            <PermitsSection />
          </SidebarSection>
          <SidebarSection title="Observations">
            <ObservationsSection />
          </SidebarSection>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar primitives ──────────────────────────────────────────────────────

function SidebarSection({
  title,
  defaultExpanded = false,
  children,
}: {
  title: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  return (
    <div className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      <button
        type="button"
        onClick={() => setIsExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors cursor-pointer"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {title}
        </span>
        <HiChevronDown
          className={`w-3.5 h-3.5 text-gray-400 dark:text-gray-500 transition-transform duration-200 shrink-0 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isExpanded ? "max-h-screen opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-3 pb-3 pt-1">{children}</div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-gray-400 dark:text-gray-500">{label}</dt>
      <dd className="text-xs text-gray-700 dark:text-gray-200 wrap-break-word">{value}</dd>
    </div>
  );
}

// ─── Permits section ─────────────────────────────────────────────────────────

const MOCK_PERMITS: PermitEntry[] = [
  { id: "user-1", displayName: "Alice Martínez", level: "edit" },
  { id: "user-2", displayName: "Bob Chen", level: "read" },
  { id: "user-3", displayName: "Carlos Rodríguez", level: "read" },
];

function PermitsSection() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: string; displayName: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [permits, setPermits] = useState<Map<string, PermitEntry>>(
    () => new Map(MOCK_PERMITS.map((p) => [p.id, p]))
  );
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    if (search.length < 3) {
      setResults([]);
      return;
    }
    searchRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/app/api/alfresco/people/search?term=${encodeURIComponent(search)}`);
        const json = await res.json();
        setResults((json.data ?? []).slice(0, 10));
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [search]);

  const addPermit = (user: { id: string; displayName: string }, level: PermitLevel) => {
    setPermits((prev) => new Map(prev).set(user.id, { ...user, level }));
    setSearch("");
    setResults([]);
  };

  const removePermit = (userId: string) => {
    setPermits((prev) => { const next = new Map(prev); next.delete(userId); return next; });
  };

  const changeLevel = (userId: string, level: PermitLevel) => {
    setPermits((prev) => {
      const next = new Map(prev);
      const entry = next.get(userId);
      if (entry) next.set(userId, { ...entry, level });
      return next;
    });
  };

  const assignedList = Array.from(permits.values());

  return (
    <div className="flex flex-col gap-2">
      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users…"
          className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 pr-7 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500"
        />
        {isSearching ? (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <HiMagnifyingGlass className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
        )}
      </div>

      {search.length > 0 && search.length < 3 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">Type at least 3 characters</p>
      )}

      {/* Search results dropdown */}
      {results.length > 0 && (
        <div className="flex flex-col max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 divide-y divide-gray-100 dark:divide-gray-700">
          {results.map((user) => {
            const isAdded = permits.has(user.id);
            return (
              <div key={user.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/40">
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">{user.displayName}</span>
                {isAdded ? (
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">Added</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => addPermit(user, "read")}
                    className="text-sm font-medium text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer shrink-0 leading-none px-1"
                    title="Add user"
                  >
                    +
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Assigned users card */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Assigned
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
            {assignedList.length}
          </span>
        </div>

        {/* User list */}
        <div className="flex flex-col max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/60">
          {assignedList.length > 0 ? (
            assignedList.map(({ id: uid, displayName, level }) => (
              <div key={uid} className="flex items-center gap-2 px-3 py-2 hover:bg-white dark:hover:bg-gray-800/60 transition-colors">
                {/* Avatar */}
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {displayName.charAt(0).toUpperCase()}
                </div>

                {/* Name */}
                <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">{displayName}</span>

                {/* Permission dropdown */}
                <Dropdown
                  label={level === "edit" ? "Edit" : "Read"}
                  size="xs"
                  color="light"
                  className="shrink-0"
                >
                  <DropdownItem onClick={() => changeLevel(uid, "read")}>Read</DropdownItem>
                  <DropdownItem onClick={() => changeLevel(uid, "edit")}>Edit</DropdownItem>
                </Dropdown>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removePermit(uid)}
                  className="p-0.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer shrink-0"
                >
                  <HiXMark className="w-3 h-3" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-3">
              No permissions assigned yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Observations section ────────────────────────────────────────────────────

type ObservationType =
  | "value_not_visible"
  | "bad_lighting"
  | "poor_image_quality"
  | "wrong_document"
  | "incorrect_data"
  | "document_incomplete"
  | "document_expired"
  | "missing_signature"
  | "illegible_text"
  | "document_damaged"
  | "wrong_format"
  | "other";

const OBSERVATION_LABELS: Record<ObservationType, string> = {
  value_not_visible: "Value not visible",
  bad_lighting: "Bad lighting",
  poor_image_quality: "Poor image quality",
  wrong_document: "Wrong document",
  incorrect_data: "Incorrect data",
  document_incomplete: "Document incomplete",
  document_expired: "Document expired",
  missing_signature: "Missing signature",
  illegible_text: "Illegible text",
  document_damaged: "Document damaged",
  wrong_format: "Wrong format",
  other: "Other",
};

type ObservationEntry = {
  id: string;
  type: ObservationType;
  description: string;
  createdAt: Date;
};

const MOCK_OBSERVATIONS: ObservationEntry[] = [];

function ObservationsSection() {
  const [observations, setObservations] = useState<ObservationEntry[]>(MOCK_OBSERVATIONS);
  const [isAdding, setIsAdding] = useState(false);
  const [newType, setNewType] = useState<ObservationType>("value_not_visible");
  const [newDescription, setNewDescription] = useState("");

  const handleAdd = () => {
    if (!newDescription.trim()) return;
    setObservations((prev) => [
      ...prev,
      { id: `obs-${Date.now()}`, type: newType, description: newDescription.trim(), createdAt: new Date() },
    ]);
    setNewDescription("");
    setNewType("value_not_visible");
    setIsAdding(false);
  };

  const handleRemove = (id: string) => {
    setObservations((prev) => prev.filter((o) => o.id !== id));
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Observation list card */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Observations</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{observations.length}</span>
        </div>
        <div className="flex flex-col max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/60">
          {observations.length > 0 ? (
            observations.map((obs) => (
              <div key={obs.id} className="flex items-start gap-2 px-3 py-2.5 hover:bg-white dark:hover:bg-gray-800/60 transition-colors group/obs">
                <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                    {OBSERVATION_LABELS[obs.type]}
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 wrap-break-word">{obs.description}</p>
                  <span className="text-xs text-gray-300 dark:text-gray-600 mt-0.5">
                    {formatDateString(obs.createdAt.toISOString())}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(obs.id)}
                  className="p-0.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer shrink-0 opacity-0 group-hover/obs:opacity-100"
                >
                  <HiXMark className="w-3 h-3" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-3">No observations yet</p>
          )}
        </div>
      </div>

      {/* New observation form */}
      {isAdding ? (
        <div className="flex flex-col gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-900/10 p-3">
          {/* Type select */}
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as ObservationType)}
            className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500 cursor-pointer"
          >
            {(Object.keys(OBSERVATION_LABELS) as ObservationType[]).map((key) => (
              <option key={key} value={key}>{OBSERVATION_LABELS[key]}</option>
            ))}
          </select>

          {/* Description textarea */}
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Describe what should be fixed…"
            rows={3}
            className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500 resize-none"
          />

          {/* Actions */}
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => { setIsAdding(false); setNewDescription(""); }}
              className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newDescription.trim()}
              className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="w-full text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 border border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 rounded-lg py-2 transition-colors cursor-pointer"
        >
          + New observation
        </button>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Review split button ──────────────────────────────────────────────────────

type ReviewAction = {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  isActive?: boolean;
};

function ReviewSplitButton({
  primary,
  secondaryActions,
}: {
  primary: ReviewAction;
  secondaryActions: ReviewAction[];
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const baseSecondary =
    "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 transition-colors cursor-pointer h-full";

  return (
    <div className="flex items-stretch ml-1 h-9">
      {secondaryActions.length === 1 && (
        <Button
          color="alternative"
          onClick={secondaryActions[0].onClick}
          className={`${baseSecondary} rounded-lg rounded-r-none `}
        >
          {secondaryActions[0].icon}
          {secondaryActions[0].label}
        </Button>
      )}
      {secondaryActions.length > 1 && (
        <div ref={dropdownRef} className="relative">
          <Button
            type="button"
            onClick={() => setDropdownOpen((p) => !p)}
            className={`${baseSecondary} rounded-lg rounded-r-none px-2.5 hover:bg-gray-50 dark:hover:bg-gray-700`}
          >
            <HiChevronDown
              className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform duration-200 ${
                dropdownOpen ? "rotate-180" : ""
              }`}
            />
          </Button>
          {dropdownOpen && (
            <div className="absolute top-full mt-1 left-0 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-50">
              {secondaryActions.map((action, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    action.onClick();
                    setDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Button
        color="blue"
        type="button"
        onClick={primary.onClick}
        className={`flex items-center h-full gap-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer ${
          secondaryActions.length > 0 ? "rounded-lg rounded-l-none" : "rounded-lg"
        } `}
      >
        {primary.icon}
        {primary.label}
      </Button>
    </div>
  );
}
