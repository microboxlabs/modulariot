"use client";

import Link from "next/link";
import { Dropdown, DropdownItem } from "flowbite-react";
import {
  HiEllipsisVertical,
  HiInformationCircle,
  HiOutlinePencilSquare,
  HiSparkles,
  HiTrash,
} from "react-icons/hi2";
import InteractiveCard, {
  INTERACTIVE_CARD_TARGET,
} from "@/features/common/components/interactive-card/interactive-card";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { getStoryKindMeta } from "../story-kind-meta";
import type { Story } from "../storytelling.types";

interface StoryCardProps {
  readonly story: Story;
  readonly lang: string;
  readonly dict: I18nRecord;
  readonly selected: boolean;
  readonly onToggleSelect: (story: Story) => void;
  readonly onDetails: (story: Story) => void;
  readonly onRename: (story: Story) => void;
  readonly onDelete: (story: Story) => void;
}

export default function StoryCard({
  story,
  lang,
  dict,
  selected,
  onToggleSelect,
  onDetails,
  onRename,
  onDelete,
}: StoryCardProps) {
  const typeMeta = getStoryKindMeta(story.kind);
  const TypeIcon = typeMeta.icon;
  const editedDate = formatDateString(
    story.updatedAt,
    "date",
    lang === "en" ? "en-US" : "es-CL"
  );

  return (
    <InteractiveCard
      selected={selected}
      // Only stories the caller owns can be deleted, so only those can be
      // selected for a mass delete.
      selection={
        story.owned
          ? {
              checked: selected,
              label: tr("selection.selectAria", dict, { name: story.title }),
              onToggle: () => onToggleSelect(story),
            }
          : undefined
      }
      media={
        <div className="flex h-40 w-full items-center justify-center bg-indigo-50 text-indigo-300 dark:bg-indigo-900/10 dark:text-indigo-500/50">
          <HiSparkles className="h-14 w-14" />
        </div>
      }
    >
      {/* Covers the whole card; the checkbox and the kebab below stay
          above it. */}
      <Link
        href={`/${lang}/storytelling/${encodeURIComponent(story.id)}`}
        aria-label={story.title}
        className={`cursor-pointer text-left ${INTERACTIVE_CARD_TARGET}`}
      />
      {/* The kind is decorative: clicks pass through to the card's link. */}
      <span
        className={`pointer-events-none absolute right-1.5 top-1.5 z-10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${typeMeta.badgeClassName}`}
      >
        <TypeIcon className="h-3 w-3" />
        {trDynamic(typeMeta.labelKey, dict)}
      </span>
      <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-3 py-2 dark:border-gray-700">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-normal text-gray-900 dark:text-white">
            {story.title}
          </p>
          {/* Last editor + last edition date. */}
          <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
            {tr("card.editedBy", dict, { name: story.updatedBy, date: editedDate })}
          </p>
        </div>

        <div className="relative shrink-0">
          <Dropdown
            inline
            arrowIcon={false}
            label=""
            placement="bottom-end"
            // flowbite's own transition-opacity/duration-100 classes are dead
            // code here — the floating panel is conditionally MOUNTED
            // (`open && <FloatingFocusManager>`), not just opacity-toggled,
            // so there's no "from" state for a plain CSS transition to
            // animate from. `starting:` (Tailwind's @starting-style variant)
            // is what actually makes enter transitions work for elements
            // that appear via insertion rather than a class flip. Only
            // opacity transitions — not `transform` — since floating-ui
            // positions this panel with its own `transform: translate(...)`;
            // transitioning that too fights floating-ui's value and makes
            // the panel fly in from (0,0) instead of just fading in place.
            // `z-20` beats every card's own z-10 (the selection checkbox) —
            // cards don't each get their own stacking context, so an open
            // dropdown must outrank that fixed value to never render behind
            // a neighboring card's UI.
            className="z-20 w-40 origin-top-right transition-opacity duration-150 ease-out starting:opacity-0"
            renderTrigger={() => (
              <button
                type="button"
                aria-label={tr("menu.label", dict)}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                <HiEllipsisVertical className="h-5 w-5" />
              </button>
            )}
          >
            {/* Sharing lives only inside the open document (the share
                button on story-detail-page.tsx, via StorySharePanel). */}
            <DropdownItem icon={HiInformationCircle} onClick={() => onDetails(story)}>
              {tr("menu.details", dict)}
            </DropdownItem>
            {story.permission !== "read" && (
              <DropdownItem icon={HiOutlinePencilSquare} onClick={() => onRename(story)}>
                {tr("menu.rename", dict)}
              </DropdownItem>
            )}
            {story.owned && (
              <DropdownItem
                icon={HiTrash}
                onClick={() => onDelete(story)}
                className="text-red-600 dark:text-red-400"
              >
                {tr("menu.delete", dict)}
              </DropdownItem>
            )}
          </Dropdown>
        </div>
      </div>
    </InteractiveCard>
  );
}
