"use client";

import { useEffect, useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { Button } from "flowbite-react";
import { HiArrowDownTray, HiLink } from "react-icons/hi2";
import { FaShare } from "react-icons/fa";
import { ShowNotification } from "@/features/notifications/notification";

/** CSS selector for the dashboard content area to capture */
const DASHBOARD_CAPTURE_SELECTOR = ".dashboard-root-grid";

/**
 * Sanitize a user-provided name for use as a download filename base.
 * Strips filesystem/URI-unsafe characters, collapses runs of whitespace
 * and underscores, and trims leading/trailing dots and underscores.
 */
export function sanitizeBaseName(name: string): string {
  let result = name
    .replaceAll(/[/\\:*?"<>|\x00-\x1f]/g, "")  // strip unsafe chars + control chars
    .replaceAll(/\s+/g, "_")                     // whitespace → underscore
    .replaceAll(/_+/g, "_");                      // collapse consecutive underscores

  // trim leading and trailing dots/underscores without backtracking-prone regex
  let start = 0;
  while (start < result.length && (result[start] === "." || result[start] === "_")) start++;
  let end = result.length;
  while (end > start && (result[end - 1] === "." || result[end - 1] === "_")) end--;

  return result.slice(start, end) || "dashboard"; // fallback if empty after sanitization
}

export interface ShareFormProps {
  dashboardName: string;
  onClose: () => void;
}

type ExportState = "image" | "pdf" | "share-image" | "share-pdf" | null;

export function ShareForm({ dashboardName, onClose }: Readonly<ShareFormProps>) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [exporting, setExporting] = useState<ExportState>(null);
  const [canShareImage, setCanShareImage] = useState(false);
  const [canSharePdf, setCanSharePdf] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (typeof navigator.canShare !== "function") return;

    // Minimal 1x1 transparent PNG; some platforms validate magic bytes in canShare.
    const PNG_PROBE = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
      0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const PDF_PROBE = new TextEncoder().encode("%PDF-1.4\n%%EOF\n");

    const probeCanShare = (bytes: Uint8Array<ArrayBuffer>, name: string, type: string) => {
      try {
        return navigator.canShare({ files: [new File([bytes], name, { type })] });
      } catch {
        return false;
      }
    };

    if (probeCanShare(PNG_PROBE, "probe.png", "image/png")) setCanShareImage(true);
    if (probeCanShare(PDF_PROBE, "probe.pdf", "application/pdf")) setCanSharePdf(true);
  }, []);

  const handleCopyKioskLink = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("kiosk", "true");
    const kioskUrl = `${globalThis.location.origin}${pathname}?${params.toString()}`;
    navigator.clipboard.writeText(kioskUrl).then(() => {
      ShowNotification({ type: "success", message: "Kiosk link copied to clipboard" });
      onClose();
    }).catch(() => {
      ShowNotification({ type: "error", message: "Failed to copy link" });
    });
  };

  const captureElement = async () => {
    const el = document.querySelector(DASHBOARD_CAPTURE_SELECTOR) as HTMLElement | null;
    if (!el) {
      ShowNotification({ type: "error", message: "Dashboard content not found" });
      return null;
    }
    const { default: html2canvas } = await import("html2canvas-pro");
    return html2canvas(el, {
      useCORS: true,
      scale: 2,
      backgroundColor: null,
      logging: false,
    });
  };

  const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas is empty"))),
        "image/png",
      );
    });

  const buildDashboardPdf = async (canvas: HTMLCanvasElement) => {
    const { jsPDF } = await import("jspdf");

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = imgWidth / imgHeight;

    const orientation = ratio > 1 ? "landscape" : "portrait";
    const pdf = new jsPDF({ orientation, unit: "px", format: "a4" });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = contentWidth / ratio;

    pdf.setFontSize(14);
    pdf.text(dashboardName, margin, margin + 10);

    pdf.setFontSize(9);
    pdf.setTextColor(128);
    pdf.text(new Date().toLocaleString(), margin, margin + 22);
    pdf.setTextColor(0);

    const imgY = margin + 30;
    const imgData = canvas.toDataURL("image/png");

    if (imgY + contentHeight <= pageHeight - margin) {
      pdf.addImage(imgData, "PNG", margin, imgY, contentWidth, contentHeight);
    } else {
      const availableHeight = pageHeight - imgY - margin;
      const scaledWidth = availableHeight * ratio;
      const finalWidth = Math.min(contentWidth, scaledWidth);
      const finalHeight = finalWidth / ratio;
      pdf.addImage(imgData, "PNG", margin, imgY, finalWidth, finalHeight);
    }

    return pdf;
  };

  const handleDownloadImage = async () => {
    setExporting("image");
    try {
      const canvas = await captureElement();
      if (!canvas) return;

      const link = document.createElement("a");
      link.download = buildExportFilename("png");
      link.href = canvas.toDataURL("image/png");
      link.click();

      ShowNotification({ type: "success", message: "Image downloaded" });
      onClose();
    } catch {
      ShowNotification({ type: "error", message: "Failed to capture dashboard image" });
    } finally {
      setExporting(null);
    }
  };

  const handleDownloadPdf = async () => {
    setExporting("pdf");
    try {
      const canvas = await captureElement();
      if (!canvas) return;

      const pdf = await buildDashboardPdf(canvas);
      pdf.save(buildExportFilename("pdf"));
      ShowNotification({ type: "success", message: "PDF downloaded" });
      onClose();
    } catch {
      ShowNotification({ type: "error", message: "Failed to export dashboard as PDF" });
    } finally {
      setExporting(null);
    }
  };

  const buildExportFilename = (ext: string) =>
    `${sanitizeBaseName(dashboardName)}_${new Date().toISOString().slice(0, 10)}.${ext}`;

  const shareBlob = async (
    state: Exclude<ExportState, null>,
    produceBlob: () => Promise<Blob | null>,
    ext: string,
    mimeType: string,
    unsupportedMessage: string,
  ) => {
    setExporting(state);
    try {
      const blob = await produceBlob();
      if (!blob) return;
      const file = new File([blob], buildExportFilename(ext), { type: mimeType });

      if (typeof navigator.canShare === "function" && !navigator.canShare({ files: [file] })) {
        ShowNotification({ type: "error", message: unsupportedMessage });
        return;
      }

      await navigator.share({
        files: [file],
        title: dashboardName,
        text: `Dashboard snapshot: ${dashboardName}`,
      });
      ShowNotification({ type: "success", message: "Shared" });
      onClose();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      ShowNotification({ type: "error", message: "Failed to share dashboard" });
    } finally {
      setExporting(null);
    }
  };

  const handleShareImage = () =>
    shareBlob(
      "share-image",
      async () => {
        const canvas = await captureElement();
        return canvas ? canvasToBlob(canvas) : null;
      },
      "png",
      "image/png",
      "Sharing this file is not supported",
    );

  const handleSharePdf = () =>
    shareBlob(
      "share-pdf",
      async () => {
        const canvas = await captureElement();
        if (!canvas) return null;
        const pdf = await buildDashboardPdf(canvas);
        return pdf.output("blob");
      },
      "pdf",
      "application/pdf",
      "Sharing PDFs is not supported on this device",
    );

  return (
    <div className="p-4 space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Share your dashboard via link or download a snapshot.
      </p>

      <div className="flex flex-col gap-2">
        {/* Authenticated kiosk link */}
        <Button color="light" size="sm" onClick={handleCopyKioskLink} disabled={exporting !== null}>
          <HiLink className="mr-2 h-4 w-4" />
          Copy link
        </Button>

        {/* Share image via OS share sheet */}
        {canShareImage && (
          <Button
            color="light"
            size="sm"
            onClick={handleShareImage}
            disabled={exporting !== null}
          >
            <FaShare className="mr-2 h-4 w-4" />
            {exporting === "share-image" ? "Preparing..." : "Share image..."}
          </Button>
        )}

        {/* Share PDF via OS share sheet */}
        {canSharePdf && (
          <Button
            color="light"
            size="sm"
            onClick={handleSharePdf}
            disabled={exporting !== null}
          >
            <FaShare className="mr-2 h-4 w-4" />
            {exporting === "share-pdf" ? "Preparing..." : "Share PDF..."}
          </Button>
        )}

        {/* Download as image */}
        <Button
          color="light"
          size="sm"
          onClick={handleDownloadImage}
          disabled={exporting !== null}
        >
          <HiArrowDownTray className="mr-2 h-4 w-4" />
          {exporting === "image" ? "Capturing..." : "Download as image"}
        </Button>

        {/* Download as PDF */}
        <Button
          color="light"
          size="sm"
          onClick={handleDownloadPdf}
          disabled={exporting !== null}
        >
          <HiArrowDownTray className="mr-2 h-4 w-4" />
          {exporting === "pdf" ? "Generating..." : "Download as PDF"}
        </Button>
      </div>
    </div>
  );
}
