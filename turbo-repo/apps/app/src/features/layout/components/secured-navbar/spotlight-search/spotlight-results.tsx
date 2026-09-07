import { memo, useState, useEffect, type ComponentType } from "react";
import { HiArrowRight } from "react-icons/hi";
import { BsStars } from "react-icons/bs";
import { MarkdownContent } from "@/features/common/utils/markdown-components";
import type { SpotlightItem, HarnessBlock } from "./types";
import type { HarnessStreamProgress } from "./harness-stream";
import {
  SpotlightHarnessProgress,
  type HarnessProgressLabels,
} from "./spotlight-harness-progress";
import { SpotlightResultItem } from "./spotlight-result-item";
import { SpotlightRow } from "./spotlight-row";

interface SectionHeaderProps {
  Icon: ComponentType<{ className?: string }>;
  label: string;
  iconClass: string;
  labelClass: string;
  dividerClass: string;
}

function SectionHeader({ Icon, label, iconClass, labelClass, dividerClass }: Readonly<SectionHeaderProps>) {
  return (
    <div className="flex items-center gap-2 px-4 pb-1 select-none">
      <Icon className={`h-3 w-3 shrink-0 ${iconClass}`} />
      <span className={`text-[10px] font-semibold uppercase tracking-wider ${labelClass}`}>
        {label}
      </span>
      <div className={`h-px flex-1 ${dividerClass}`} />
    </div>
  );
}

/** The committed question, rendered like a sent chat message — right-aligned,
 * above the progress/answer for it. Present the moment a question is
 * committed (before the run even reaches its first progress frame) and
 * stays up for as long as that answer is on screen, including after the
 * input has been cleared for the next question. */
function HarnessQuestionBubble({ text }: Readonly<{ text: string }>) {
  return (
    <div className="px-4 pt-3 pb-1 flex justify-end">
      <div className="animate-spotlight-bubble max-w-[85%] rounded-lg rounded-br-none bg-gray-100 px-3 py-1.5 text-sm text-gray-700 dark:bg-gray-700 dark:text-gray-200">
        {text}
      </div>
    </div>
  );
}

/** Gold-badge stars icon + one-line notice — the error and empty states share it. */
function HarnessNotice({ label }: Readonly<{ label: string }>) {
  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-linear-to-br from-[rgb(241,179,0)] to-[rgb(209,137,0)] ring-1 ring-inset ring-black/6 dark:ring-white/10">
        <BsStars className="h-3 w-3 text-white" />
      </div>
      <p className="pt-1 text-sm text-gray-500 dark:text-gray-400">
        {label}
      </p>
    </div>
  );
}

function MarkdownBlock({ value }: Readonly<{ value: string }>) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(value.slice(0, i));
      if (i >= value.length) clearInterval(interval);
    }, 5);
    return () => clearInterval(interval);
  }, [value]);

  return (
    <div className="text-sm text-gray-700 dark:text-gray-200">
      <MarkdownContent>{displayed}</MarkdownContent>
    </div>
  );
}

function HarnessAnswerItem({ item, onHover, onOpenUrl, navigateHeading, selectedItemId }: Readonly<{
  item: SpotlightItem;
  onHover: (id: string | null) => void;
  onOpenUrl: (url: string) => void;
  navigateHeading: string;
  selectedItemId: string | null;
}>) {
  const markdownBlocks = (item.blocks ?? []).filter((b) => b.type === "markdown");
  const urlBlocks = (item.blocks ?? []).filter((b): b is HarnessBlock & { type: "url" } => b.type === "url");

  if (markdownBlocks.length === 0 && urlBlocks.length === 0) return null;

  return (
    <div className="pb-1">
      {/* Markdown answer */}
      {markdownBlocks.length > 0 && (
        <div className="px-4 py-3 select-text cursor-default">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-linear-to-br from-[rgb(241,179,0)] to-[rgb(209,137,0)] ring-1 ring-inset ring-black/6 dark:ring-white/10">
              <BsStars className="h-3 w-3 text-white" />
            </div>
            <div className="min-w-0 flex-1 flex flex-col gap-2">
              {markdownBlocks.map((block) => (
                <div key={block.value.slice(0, 40)} className="text-sm text-gray-700 dark:text-gray-200">
                  <MarkdownBlock value={block.value} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Harness-generated go-to actions */}
      {urlBlocks.length > 0 && (
        <div className="pt-1">
          <SectionHeader
            Icon={HiArrowRight}
            label={navigateHeading}
            iconClass="text-amber-500 dark:text-amber-400"
            labelClass="text-amber-500 dark:text-amber-400"
            dividerClass="bg-gray-100 dark:bg-gray-700"
          />
          {urlBlocks.map((block, i) => {
            const id = `harness-url-${i}`;
            return (
              <SpotlightRow
                key={id}
                item={{
                  id,
                  label: block.value.name,
                  kind: "harness-goto",
                  keywords: [],
                  onSelect: () => onOpenUrl(block.value.url),
                }}
                isSelected={id === selectedItemId}
                onSelect={(it) => it.onSelect()}
                onHover={onHover}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface SpotlightResultsProps {
  staticItems: SpotlightItem[];
  harnessItems: SpotlightItem[];
  isHarnessLoading: boolean;
  harnessQueried: boolean;
  /** The committed question, shown as a locked chat bubble — empty when no
   * question is active. */
  harnessQuestion: string;
  harnessProgress: HarnessStreamProgress;
  harnessProgressLabels: HarnessProgressLabels;
  harnessError: boolean;
  harnessErrorLabel: string;
  harnessRetryItem: SpotlightItem | null;
  harnessTakeToChatItem: SpotlightItem | null;
  selectedItemId: string | null;
  onSelect: (item: SpotlightItem) => void;
  onHover: (id: string | null) => void;
  onOpenUrl: (url: string) => void;
  navigateHeading: string;
  harnessEmptyLabel: string;
}

export const SpotlightResults = memo(function SpotlightResults({
  staticItems,
  harnessItems,
  isHarnessLoading,
  harnessQueried,
  harnessQuestion,
  harnessProgress,
  harnessProgressLabels,
  harnessError,
  harnessErrorLabel,
  harnessRetryItem,
  harnessTakeToChatItem,
  selectedItemId,
  onSelect,
  onHover,
  onOpenUrl,
  navigateHeading,
  harnessEmptyLabel,
}: Readonly<SpotlightResultsProps>) {
  const hasStaticResults = staticItems.some((i) => !i.isGroupHeader);
  const showHarnessResults = isHarnessLoading || harnessItems.length > 0;
  const showHarnessEmpty =
    harnessQueried && !isHarnessLoading && !harnessError && harnessItems.length === 0;
  const showHarnessSection =
    !!harnessQuestion || showHarnessResults || showHarnessEmpty || harnessError;

  if (!hasStaticResults && !showHarnessSection) return null;

  const hasSeparator = showHarnessSection && hasStaticResults;

  return (
    <div className="max-h-[60vh] overflow-y-auto">
      {/* ── Harness section — locked question + answer/gotos, once the query is
          committed. Before that, asking Harness is the input's own implicit
          default action (Enter fires it), so it has no row of its own here. ── */}
      {showHarnessSection && (
        <div>
          {harnessQuestion && (
            // Keyed by its own text so a brand-new question always remounts
            // (and re-plays the entrance animation) instead of just patching
            // the text of the previous bubble in place.
            <HarnessQuestionBubble key={harnessQuestion} text={harnessQuestion} />
          )}
          {harnessError && (
            <>
              <HarnessNotice label={harnessErrorLabel} />
              {harnessRetryItem && (
                <SpotlightResultItem
                  item={harnessRetryItem}
                  isSelected={harnessRetryItem.id === selectedItemId}
                  onSelect={onSelect}
                  onHover={onHover}
                />
              )}
            </>
          )}
          {showHarnessEmpty && <HarnessNotice label={harnessEmptyLabel} />}
          {showHarnessResults && (
            isHarnessLoading ? (
              <SpotlightHarnessProgress
                progress={harnessProgress}
                labels={harnessProgressLabels}
              />
            ) : (
              harnessItems.map((item) => (
                <HarnessAnswerItem
                  key={item.id}
                  item={item}
                  onHover={onHover}
                  onOpenUrl={onOpenUrl}
                  navigateHeading={navigateHeading}
                  selectedItemId={selectedItemId}
                />
              ))
            )
          )}
          {harnessTakeToChatItem && (
            <SpotlightResultItem
              item={harnessTakeToChatItem}
              isSelected={harnessTakeToChatItem.id === selectedItemId}
              onSelect={onSelect}
              onHover={onHover}
            />
          )}
        </div>
      )}

      {/* ── Navigate / static results ─────────────────────────────────────────── */}
      {hasStaticResults && (
        <div className={hasSeparator ? "border-t border-gray-100 dark:border-gray-700 pt-1" : ""}>
          <SectionHeader
            Icon={HiArrowRight}
            label={navigateHeading}
            iconClass="text-gray-400 dark:text-gray-500"
            labelClass="text-gray-400 dark:text-gray-500"
            dividerClass="bg-gray-100 dark:bg-gray-700"
          />
          {staticItems.map((item) => {
            if (item.isGroupHeader) {
              return <div key={item.id} className="px-4 h-fit" />;
            }
            return (
              <SpotlightResultItem
                key={item.id}
                item={item}
                isSelected={item.id === selectedItemId}
                onSelect={onSelect}
                onHover={onHover}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});
