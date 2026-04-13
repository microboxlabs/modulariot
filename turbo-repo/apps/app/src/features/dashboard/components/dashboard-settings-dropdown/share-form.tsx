"use client";

import { useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { Button } from "flowbite-react";
import { HiArrowDownTray, HiLink } from "react-icons/hi2";
import { ShowNotification } from "@/features/notifications/notification";

/** CSS selector for the dashboard content area to capture */
const DASHBOARD_CAPTURE_SELECTOR = ".dashboard-root-grid";

/**
 * Sanitize a user-provided name for use as a download filename base.
 * Strips filesystem/URI-unsafe characters, collapses runs of whitespace
 * and underscores, and trims leading/trailing dots and underscores.
 */
export function sanitizeBaseName(name: string): string {
  return name
    .replaceAll(/[/\\:*?"<>|\x00-\x1f]/g, "")  // strip unsafe chars + control chars
    .replaceAll(/\s+/g, "_")                     // whitespace → underscore
    .replaceAll(/_+/g, "_")                       // collapse consecutive underscores
    .replace(/^[._]+/, "")                        // trim leading dots/underscores
    .replace(/[._]+$/, "")                        // trim trailing dots/underscores
    || "dashboard";                               // fallback if empty after sanitization
}

export interface ShareFormProps {
  dashboardName: string;
  onClose: () => void;
}

export function ShareForm({ dashboardName, onClose }: Readonly<ShareFormProps>) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [exporting, setExporting] = useState<"image" | "pdf" | null>(null);

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

  const handleDownloadImage = async () => {
    setExporting("image");
    try {
      const canvas = await captureElement();
      if (!canvas) return;

      const link = document.createElement("a");
      link.download = `${sanitizeBaseName(dashboardName)}_${new Date().toISOString().slice(0, 10)}.png`;
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

      const { jsPDF } = await import("jspdf");

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = imgWidth / imgHeight;

      // Use landscape if wider than tall, portrait otherwise
      const orientation = ratio > 1 ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation, unit: "px", format: "a4" });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = contentWidth / ratio;

      // Add title
      pdf.setFontSize(14);
      pdf.text(dashboardName, margin, margin + 10);

      // Add date
      pdf.setFontSize(9);
      pdf.setTextColor(128);
      pdf.text(new Date().toLocaleString(), margin, margin + 22);
      pdf.setTextColor(0);

      const imgY = margin + 30;
      const imgData = canvas.toDataURL("image/png");

      if (imgY + contentHeight <= pageHeight - margin) {
        // Fits on one page
        pdf.addImage(imgData, "PNG", margin, imgY, contentWidth, contentHeight);
      } else {
        // Scale down to fit
        const availableHeight = pageHeight - imgY - margin;
        const scaledWidth = availableHeight * ratio;
        const finalWidth = Math.min(contentWidth, scaledWidth);
        const finalHeight = finalWidth / ratio;
        pdf.addImage(imgData, "PNG", margin, imgY, finalWidth, finalHeight);
      }

      pdf.save(`${sanitizeBaseName(dashboardName)}_${new Date().toISOString().slice(0, 10)}.pdf`);
      ShowNotification({ type: "success", message: "PDF downloaded" });
      onClose();
    } catch {
      ShowNotification({ type: "error", message: "Failed to export dashboard as PDF" });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Share your dashboard via link or download a snapshot.
      </p>

      <div className="flex flex-col gap-2">
        {/* Authenticated kiosk link */}
        <Button color="light" size="sm" onClick={handleCopyKioskLink}>
          <HiLink className="mr-2 h-4 w-4" />
          Copy link
        </Button>

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
