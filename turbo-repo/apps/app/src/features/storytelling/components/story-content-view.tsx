"use client";

import type { Ref } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { StoryRender } from "../story-content";
import { HtmlPreviewer } from "./previewers/html/html-previewer";
import { MarkdownPreviewer } from "./previewers/markdown/markdown-previewer";
import { PdfPreviewer } from "./previewers/pdf/pdf-previewer";
import { PptPreviewer } from "./previewers/ppt/ppt-previewer";
import type { SearchableHandle } from "./previewers/searchable";
import { SectionsPreviewer } from "./previewers/sections/sections-previewer";
import { SvgPreviewer } from "./previewers/svg/svg-previewer";

interface StoryContentViewProps {
  readonly render: StoryRender;
  readonly title: string;
  readonly dict: I18nRecord;
  readonly previewerRef?: Ref<SearchableHandle>;
  readonly onReadyChange?: (ready: boolean) => void;
  readonly onAskHarness?: (label: string) => void;
}

/** The previewer for one version's content, picked by what the content is. */
export function StoryContentView({
  render,
  title,
  dict,
  previewerRef,
  onReadyChange,
  onAskHarness,
}: StoryContentViewProps) {
  switch (render.type) {
    case "html":
      return (
        <HtmlPreviewer
          ref={previewerRef}
          html={render.html}
          title={title}
          dict={dict}
          onReadyChange={onReadyChange}
          onAskHarness={onAskHarness}
        />
      );
    case "markdown":
      return (
        <MarkdownPreviewer
          ref={previewerRef}
          content={render.markdown}
          dict={dict}
          onReadyChange={onReadyChange}
        />
      );
    case "deck":
      return (
        <PptPreviewer
          ref={previewerRef}
          deck={render.deck}
          onReadyChange={onReadyChange}
        />
      );
    case "pdf":
      return (
        <PdfPreviewer
          ref={previewerRef}
          data={render.data}
          title={title}
          dict={dict}
          onReadyChange={onReadyChange}
        />
      );
    case "svg":
      return (
        <SvgPreviewer
          svg={render.svg}
          title={title}
          onReadyChange={onReadyChange}
        />
      );
    case "sections":
      return (
        <SectionsPreviewer
          ref={previewerRef}
          sections={render.sections}
          onReadyChange={onReadyChange}
        />
      );
    default:
      return (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-gray-500 dark:text-gray-400">
          {tr("detail.emptyContent", dict)}
        </div>
      );
  }
}
