"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from "react";
import type { ToolCallMessagePartProps } from "@assistant-ui/react";
import DOMPurify from "dompurify";
import { Badge, Modal, ModalBody, ModalHeader } from "flowbite-react";
import {
  HiArrowDownTray,
  HiArrowsPointingOut,
  HiArrowsRightLeft,
  HiBookmark,
  HiCheck,
  HiClipboard,
} from "react-icons/hi2";
import { MarkdownContent } from "@/features/common/utils/markdown-components";
import { MERMAID_COMPONENTS } from "@/features/storytelling/components/previewers/markdown/markdown-previewer";
import { MermaidDiagram } from "@/features/storytelling/components/previewers/markdown/mermaid-diagram";
import { useHarnessChatTr } from "../../context/harness-chat-i18n-context";
import { ARTIFACT_FILES, type ShowArtifactArgs } from "../show-artifact-args";
import {
  FILL_DRAWING,
  svgMarkupSize,
  useDrawingSize,
  ZoomableView,
  type Size,
} from "./zoomable-view";

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

const EXPANDED_MODAL_THEME = {
  root: { sizes: { "7xl": "max-w-none" } },
  content: {
    base: "relative h-[90dvh] w-[95vw] p-0 md:h-[90dvh]",
    inner: "h-full max-h-none",
  },
  body: { base: "flex min-h-0 flex-1 flex-col overflow-hidden p-3" },
};

const isDrawing = (kind: ShowArtifactArgs["kind"]) =>
  kind === "svg" || kind === "mermaid";

/** The drawing at its own size, scrolling when wider than the card. */
const NaturalSize: FC<{ size?: Size | null; children: ReactNode }> = ({
  size,
  children,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const natural = useDrawingSize(ref, size);
  return (
    <div className="max-h-96 overflow-auto rounded bg-white p-2">
      <div ref={ref} className={FILL_DRAWING} style={natural ?? undefined}>
        {children}
      </div>
    </div>
  );
};

const ArtifactBody: FC<{
  artifact: ShowArtifactArgs;
  content: string;
  view: "card" | "natural" | "expanded";
}> = ({ artifact, content, view }) => {
  const expanded = view === "expanded";
  const svgSize = useMemo(
    () => (artifact.kind === "svg" && content ? svgMarkupSize(content) : null),
    [artifact.kind, content]
  );
  switch (artifact.kind) {
    case "svg": {
      if (!content) return null;
      const image = (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(content)}`}
          alt={artifact.title}
          draggable={false}
          className={view === "card" ? "h-auto max-w-full object-contain" : ""}
        />
      );
      if (expanded)
        return (
          <ZoomableView size={svgSize} className="min-h-0 flex-1">
            {image}
          </ZoomableView>
        );
      if (view === "natural")
        return <NaturalSize size={svgSize}>{image}</NaturalSize>;
      return (
        <div className="flex max-h-96 justify-center overflow-auto rounded bg-white p-2">
          {image}
        </div>
      );
    }
    case "mermaid": {
      const diagram = <MermaidDiagram code={content} />;
      if (expanded)
        return (
          <ZoomableView className="min-h-0 flex-1">{diagram}</ZoomableView>
        );
      if (view === "natural") return <NaturalSize>{diagram}</NaturalSize>;
      return <div className="max-h-96 overflow-auto">{diagram}</div>;
    }
    case "markdown":
      return (
        <div
          className={
            expanded ? "min-h-0 flex-1 overflow-auto" : "max-h-96 overflow-auto"
          }
        >
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
          className={`w-full rounded border-0 bg-white ${expanded ? "min-h-0 flex-1" : "h-96"}`}
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
  const [natural, setNatural] = useState(false);
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
          {isDrawing(artifact.kind) && (
            <button
              type="button"
              className={actionClass}
              title={tr("harnessChat.ui.showArtifact.actualSizeInline")}
              aria-label={tr("harnessChat.ui.showArtifact.actualSizeInline")}
              aria-pressed={natural}
              onClick={() => setNatural((on) => !on)}
            >
              <HiArrowsRightLeft className="h-4 w-4" />
            </button>
          )}
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
        <ArtifactBody
          artifact={artifact}
          content={content}
          view={natural ? "natural" : "card"}
        />
      )}
      <Modal
        dismissible
        show={expanded}
        onClose={() => setExpanded(false)}
        size="7xl"
        theme={EXPANDED_MODAL_THEME}
      >
        <ModalHeader>{artifact.title}</ModalHeader>
        <ModalBody>
          {expanded && (
            <ArtifactBody
              artifact={artifact}
              content={content}
              view="expanded"
            />
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
