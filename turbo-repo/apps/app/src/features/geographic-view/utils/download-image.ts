import { tr } from "@/features/i18n/tr.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { toast } from "sonner";

export async function downloadImage(
  imageUrl: string,
  dictionary?: I18nRecord,
  filename?: string
): Promise<boolean> {
  const effectiveFilename = filename ?? (
    `${dictionary ? tr("geographic_view.image_prefix", dictionary) : "image"}-${new Date().toISOString().slice(0, 10)}.png`
  );

  // For data URLs (base64), convert directly to blob
  if (imageUrl.startsWith("data:")) {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = effectiveFilename;
    link.href = blobUrl;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
    return true;
  }

  // For blob URLs, download directly
  if (imageUrl.startsWith("blob:")) {
    const link = document.createElement("a");
    link.download = effectiveFilename;
    link.href = imageUrl;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return true;
  }

  // For internal API URLs (same-origin)
  if (imageUrl.startsWith("/api") || imageUrl.startsWith("/app/api")) {
    const response = await fetch(imageUrl, {
      credentials: "include",
    });
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = effectiveFilename;
    link.href = blobUrl;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
    return true;
  }

  // For HTTP URLs, try fetch with cors fallback
  try {
    const response = await fetch(imageUrl, {
      mode: "cors",
      credentials: "include",
    });
    if (!response.ok) throw new Error("Fetch failed");
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = effectiveFilename;
    link.href = blobUrl;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
    return true;
  } catch {
    toast.error(
      dictionary
        ? tr("download_failed", dictionary)
        : "Download failed — opening in a new tab"
    );
    // Fallback: open in new tab for user to save manually
    window.open(imageUrl, "_blank");
    return false;
  }
}
