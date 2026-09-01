"use client";

const base_path = process.env.NEXT_PUBLIC_BASE_PATH;
export const PDF_PREVIEW_URL = `${base_path ?? ""}/api/storytelling/pdf-preview`;
export const PDF_DOWNLOAD_FILENAME = "audit-report-demo.pdf";

interface PdfFrameProps {
  readonly src: string;
  readonly title: string;
}

/** Browsers render PDFs natively — no library needed, unlike PPT/HTML. Just
 * an <iframe> pointed at a same-origin, auth-gated route. Exported so
 * ppt-previewer.tsx can reuse it for the PPT story's PDF-rendered preview. */
export function PdfFrame({ src, title }: PdfFrameProps) {
  return <iframe src={src} title={title} className="h-full w-full border-0" />;
}

interface PdfPreviewerProps {
  readonly title: string;
}

export function PdfPreviewer({ title }: PdfPreviewerProps) {
  return <PdfFrame src={PDF_PREVIEW_URL} title={title} />;
}
