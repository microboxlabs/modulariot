export async function downloadImage(imageUrl: string): Promise<void> {
  const filename = `imagen-${new Date().toISOString().slice(0, 10)}.png`;

  // For data URLs (base64), convert directly to blob
  if (imageUrl.startsWith("data:")) {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = filename;
    link.href = blobUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
    return;
  }

  // For blob URLs, download directly
  if (imageUrl.startsWith("blob:")) {
    const link = document.createElement("a");
    link.download = filename;
    link.href = imageUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  // For HTTP URLs, try fetch with cors fallback
  try {
    const response = await fetch(imageUrl, { mode: "cors" });
    if (!response.ok) throw new Error("Fetch failed");
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = filename;
    link.href = blobUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch {
    // Fallback: open in new tab for user to save manually
    window.open(imageUrl, "_blank");
  }
}
