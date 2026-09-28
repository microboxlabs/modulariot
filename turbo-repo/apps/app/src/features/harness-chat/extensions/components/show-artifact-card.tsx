"use client";

import { useEffect, useMemo, useState, type FC } from "react";
import type { ToolCallMessagePartProps } from "@assistant-ui/react";
import DOMPurify from "dompurify";
import { Badge, Modal, ModalBody, ModalHeader } from "flowbite-react";
import {
  HiArrowDownTray,
  HiArrowsPointingOut,
  HiBookmark,
  HiCheck,
  HiClipboard,
} from "react-icons/hi2";
import { MarkdownContent } from "@/features/common/utils/markdown-components";
import { MERMAID_COMPONENTS } from "@/features/storytelling/components/previewers/markdown/markdown-previewer";
import { MermaidDiagram } from "@/features/storytelling/components/previewers/markdown/mermaid-diagram";
import { useHarnessChatTr } from "../../context/harness-chat-i18n-context";
import { ARTIFACT_FILES, type ShowArtifactArgs } from "../show-artifact-args";

const KIND_LABELS: Record<ShowArtifactArgs["kind"], string> = {
  svg: "SVG",
  mermaid: "Mermaid",
  markdown: "Markdown",
  html: "HTML",
};

/** Keeps a model-written page from loading anything: it can run its own
 * scripts and styles and show inline images. */
const HTML_CSP =
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; ' +
  "script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:\">";

/** The SVG with scripts, handlers, styles, links and foreign content removed,
 * as standalone XML (with its namespace) so it can be shown as an image. */
export function sanitizeSvg(svg: string): string {
  if (!DOMPurify.isSupported) return "";
  const fragment = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["style", "foreignObject", "image", "use", "a"],
    RETURN_DOM_FRAGMENT: true,
  });
  const root = fragment.querySelector("svg");
  return root ? new XMLSerializer().serializeToString(root) : "";
}

/** The policy goes first: a leading <meta> always lands in the parsed head,
 * whatever the page contains. The page's own doctype, if any, is ignored. */
export function sandboxedHtml(html: string): string {
  return `<!doctype html>${HTML_CSP}${html}`;
}

function fileName(artifact: ShowArtifactArgs): string {
  const base =
    artifact.title
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .toLowerCase() || "artifact";
  return `${base.slice(0, 80)}.${ARTIFACT_FILES[artifact.kind].extension}`;
}

function download(artifact: ShowArtifactArgs, content: string): void {
  const blob = new Blob([content], {
    type: ARTIFACT_FILES[artifact.kind].mimeType,
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName(artifact);
  link.click();
  URL.revokeObjectURL(url);
}

const ArtifactBody: FC<{
  artifact: ShowArtifactArgs;
  content: string;
  expanded: boolean;
}> = ({ artifact, content, expanded }) => {
  const height = expanded ? "h-[75vh]" : "max-h-96";
  switch (artifact.kind) {
    case "svg":
      return content ? (
        <div
          className={`flex justify-center overflow-auto rounded bg-white p-2 ${height}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(content)}`}
            alt={artifact.title}
            className="h-auto max-w-full object-contain"
          />
        </div>
      ) : null;
    case "mermaid":
      return (
        <div className={`overflow-auto ${height}`}>
          <MermaidDiagram code={content} />
        </div>
      );
    case "markdown":
      return (
        <div className={`overflow-auto ${height}`}>
          <MarkdownContent
            variant="document"
            className="text-sm"
            components={MERMAID_COMPONENTS}
          >
            {content}
          </MarkdownContent>
        </div>
      );
    case "html":
      return (
        <iframe
          title={artifact.title}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          srcDoc={sandboxedHtml(content)}
          className={`w-full rounded border-0 bg-white ${expanded ? "h-[75vh]" : "h-96"}`}
        />
      );
  }
};

const actionClass =
  "rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white";

/**
 * A diagram, note or page the agent made. `onSaveAsStory` shows a save
 * action when given; nothing passes it yet.
 */
export const ArtifactCard: FC<{
  artifact: ShowArtifactArgs;
  onSaveAsStory?: (artifact: ShowArtifactArgs) => void;
}> = ({ artifact, onSaveAsStory }) => {
  const tr = useHarnessChatTr();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const content = useMemo(
    () =>
      artifact.kind === "svg"
        ? sanitizeSvg(artifact.content)
        : artifact.content,
    [artifact.kind, artifact.content]
  );

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const header = (
    <div className="flex min-w-0 items-center gap-2">
      <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
        {artifact.title}
      </span>
      <Badge color="gray" size="xs">
        {KIND_LABELS[artifact.kind]}
      </Badge>
    </div>
  );

  if (artifact.omitted) {
    return (
      <div className="w-full max-w-[90%] rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        {header}
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {tr("harnessChat.ui.showArtifact.omitted")}
        </p>
      </div>
    );
  }

  const copy = () => {
    void navigator.clipboard?.writeText(content).then(
      () => setCopied(true),
      () => undefined
    );
  };

  return (
    <div className="w-full max-w-[90%] rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-2 flex items-center justify-between gap-2">
        {header}
        <div className="flex shrink-0 items-center gap-1">
          {onSaveAsStory && (
            <button
              type="button"
              className={actionClass}
              title={tr("harnessChat.ui.showArtifact.saveAsStory")}
              aria-label={tr("harnessChat.ui.showArtifact.saveAsStory")}
              onClick={() => onSaveAsStory(artifact)}
            >
              <HiBookmark className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            className={actionClass}
            title={
              copied
                ? tr("harnessChat.ui.showArtifact.copied")
                : tr("harnessChat.ui.showArtifact.copy")
            }
            aria-label={tr("harnessChat.ui.showArtifact.copy")}
            onClick={copy}
          >
            {copied ? (
              <HiCheck className="h-4 w-4" />
            ) : (
              <HiClipboard className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            className={actionClass}
            title={tr("harnessChat.ui.showArtifact.download")}
            aria-label={tr("harnessChat.ui.showArtifact.download")}
            onClick={() => download(artifact, content)}
          >
            <HiArrowDownTray className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={actionClass}
            title={tr("harnessChat.ui.showArtifact.expand")}
            aria-label={tr("harnessChat.ui.showArtifact.expand")}
            onClick={() => setExpanded(true)}
          >
            <HiArrowsPointingOut className="h-4 w-4" />
          </button>
        </div>
      </div>
      {!expanded && (
        <ArtifactBody artifact={artifact} content={content} expanded={false} />
      )}
      <Modal
        dismissible
        show={expanded}
        onClose={() => setExpanded(false)}
        size="7xl"
      >
        <ModalHeader>{artifact.title}</ModalHeader>
        <ModalBody>
          {expanded && (
            <ArtifactBody artifact={artifact} content={content} expanded />
          )}
        </ModalBody>
      </Modal>
    </div>
  );
};

/** The `show_artifact` tool call. Informational, so it resolves itself on
 * mount like `show_dashlet`. */
export const ShowArtifactCard: FC<
  ToolCallMessagePartProps<ShowArtifactArgs, Record<string, never>>
> = ({ args, result, addResult }) => {
  useEffect(() => {
    if (!result) addResult({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!args || !(args.kind in KIND_LABELS) || typeof args.content !== "string")
    return null;
  return <ArtifactCard artifact={args} />;
};
