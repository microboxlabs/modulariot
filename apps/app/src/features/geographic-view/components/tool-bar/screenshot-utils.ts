export const handleScreenshot = async (
  setIsCapturing: React.Dispatch<React.SetStateAction<boolean>>,
  setStatus: React.Dispatch<React.SetStateAction<string>>,
  setScreenshotDataUrl: React.Dispatch<React.SetStateAction<string | null>>,
  setShowPreviewModal: React.Dispatch<React.SetStateAction<boolean>>
) => {
  setIsCapturing(true);
  setStatus("Preparing screenshot...");

  try {
    // Wait for any pending rendering to complete
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const containerImg = await captureMapContainer();
    if (containerImg && containerImg.length > 50000) {
      setScreenshotDataUrl(containerImg);
      setShowPreviewModal(true);
      return;
    }

    // Fallback: try direct canvas capture
    const mapboxCanvas = document.querySelector(
      "canvas.mapboxgl-canvas"
    ) as HTMLCanvasElement;
    if (mapboxCanvas) {
      const mapboxImg = mapboxCanvas.toDataURL("image/png");
      if (mapboxImg.length > 10000) {
        setScreenshotDataUrl(mapboxImg);
        setShowPreviewModal(true);
        return;
      }
    }

    setStatus("Screenshot failed. Please try again.");
  } catch (error) {
    console.error("Screenshot error:", error);
    setStatus("Error capturing screenshot");
  } finally {
    setIsCapturing(false);
  }
};

// Capture the entire map container
export const captureMapContainer = async () => {
  try {
    const mapContainer = document.querySelector(".mapboxgl-map")?.parentElement;
    if (!mapContainer) return null;

    const containerRect = mapContainer.getBoundingClientRect();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    canvas.width = containerRect.width * (window.devicePixelRatio || 1);
    canvas.height = containerRect.height * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    const allCanvases = mapContainer.querySelectorAll("canvas");
    for (const canvasEl of allCanvases) {
      const canvasRect = canvasEl.getBoundingClientRect();
      const relativeX = canvasRect.left - containerRect.left;
      const relativeY = canvasRect.top - containerRect.top;
      ctx.drawImage(
        canvasEl,
        relativeX,
        relativeY,
        canvasRect.width,
        canvasRect.height
      );
    }

    return canvas.toDataURL("image/png");
  } catch (error) {
    console.error("Error capturing map container:", error);
    return null;
  }
};
