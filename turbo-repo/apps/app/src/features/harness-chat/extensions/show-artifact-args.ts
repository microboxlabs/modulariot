export const SHOW_ARTIFACT_TOOL = "show_artifact";

export type ArtifactKind = "svg" | "mermaid" | "markdown" | "html";

export type ShowArtifactArgs = {
  id: string;
  kind: ArtifactKind;
  title: string;
  content: string;
  source?: string;
  /** Set when the content was dropped to keep the stored thread small. */
  omitted?: boolean;
};

export const ARTIFACT_FILES: Record<
  ArtifactKind,
  { extension: string; mimeType: string }
> = {
  svg: { extension: "svg", mimeType: "image/svg+xml" },
  mermaid: { extension: "mmd", mimeType: "text/plain" },
  markdown: { extension: "md", mimeType: "text/markdown" },
  html: { extension: "html", mimeType: "text/html" },
};
