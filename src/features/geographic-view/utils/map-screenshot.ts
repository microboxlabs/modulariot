import { logger } from "@/lib/logger";

/**
 * Takes a screenshot of a map element and downloads it
 * Uses native Mapbox GL and DeckGL capabilities
 *
 * @param {Object} options - Screenshot options
 * @param {string} options.filename - The filename for the downloaded image (default: 'map-screenshot.png')
 * @param {(status: string) => void} options.onStatusChange - Callback for status updates
 * @param {boolean} options.debugMode - Whether to enable debug mode
 * @returns {Promise<boolean>} - Promise that resolves to true if successful, false otherwise
 */
export async function captureAndDownloadMap(
  options: {
    filename?: string;
    fileType?: string;
    onStatusChange?: (status: string) => void;
    debugMode?: boolean;
  } = {},
): Promise<boolean> {
  const {
    filename = options.filename ||
      `map-screenshot-${new Date().toISOString().slice(0, 10)}.png`,
    fileType = options.fileType || "image/png",
    onStatusChange = () => {},
    debugMode = false,
  } = options;

  onStatusChange("Finding map canvases...");

  try {
    // Specifically find both the DeckGL overlay canvas and the Mapbox canvas
    const deckGLCanvas = document.querySelector(
      "canvas#deckgl-overlay",
    ) as HTMLCanvasElement;
    const mapboxCanvas = document.querySelector(
      "canvas.mapboxgl-canvas",
    ) as HTMLCanvasElement;

    if (debugMode) {
      logger.info("Canvas elements found:", { mapboxCanvas, deckGLCanvas });
    }

    // Try to combine both canvases first - this is the most reliable approach
    if (mapboxCanvas && deckGLCanvas) {
      onStatusChange("Combining canvas elements...");

      try {
        // Create a new canvas for the combined image
        const combinedCanvas = document.createElement("canvas");
        const ctx = combinedCanvas.getContext("2d");

        if (!ctx) {
          throw new Error("Could not get canvas context");
        }

        // Use the dimensions of the Mapbox canvas (they should be the same size)
        combinedCanvas.width = mapboxCanvas.width;
        combinedCanvas.height = mapboxCanvas.height;

        // First draw the Mapbox map (base layer)
        ctx.drawImage(mapboxCanvas, 0, 0);

        // Then draw the DeckGL overlay (pins, markers, etc.)
        ctx.drawImage(deckGLCanvas, 0, 0);

        // Convert to data URL and download
        const imgData = combinedCanvas.toDataURL(fileType);
        downloadImage(imgData, filename);
        onStatusChange("Combined screenshot captured!");
        return true;
      } catch (err) {
        if (debugMode) {
          logger.error("Error combining canvases:", err);
        }
        // Continue to other methods if combining fails
      }
    }

    // If combining failed, try individual canvases

    // Try to find the Mapbox GL map instance
    const mapboxMapElement = document.querySelector(".mapboxgl-map");
    const mapboxMap =
      (window as any).mapboxMap ||
      (mapboxMapElement && (mapboxMapElement as any).__mapboxMap);

    // Try to find the DeckGL instance
    const deckGL = (window as any).deckGL;

    if (debugMode) {
      logger.info("Map instances:", { mapboxMap, deckGL });
    }

    // If we have direct access to the map instance, use its native methods
    if (mapboxMap && typeof mapboxMap.getCanvas === "function") {
      onStatusChange("Capturing map using Mapbox GL native method...");

      // Get the canvas from the map
      const canvas = mapboxMap.getCanvas();

      if (!canvas) {
        throw new Error("Could not get map canvas");
      }

      // Convert to data URL
      const imgData = canvas.toDataURL("image/png");

      // Download the image
      downloadImage(imgData, filename);
      onStatusChange("Screenshot captured! (Map only)");
      return true;
    }

    // If we have access to DeckGL, try to use its screenshot method
    if (deckGL && typeof deckGL.deck?.canvas?.toDataURL === "function") {
      onStatusChange("Capturing map using DeckGL native method...");

      const imgData = deckGL.deck.canvas.toDataURL("image/png");
      downloadImage(imgData, filename);
      onStatusChange("Screenshot captured! (Overlay only)");
      return true;
    }

    // Fallback: Find any canvas elements that might be part of the map
    onStatusChange("Looking for any map canvases...");

    // Find all canvas elements that might be part of the map
    const mapCanvases = Array.from(document.querySelectorAll("canvas")).filter(
      (canvas) => {
        // Filter for canvases that are likely to be map canvases
        return (
          canvas.className.includes("mapboxgl") ||
          canvas.id.includes("deckgl") ||
          canvas.width > 200
        ); // Assume larger canvases are map canvases
      },
    );

    if (debugMode) {
      logger.info("Found map canvases:", mapCanvases);
    }

    if (mapCanvases.length > 0) {
      onStatusChange("Capturing map from canvas...");

      // If we have multiple canvases, try to combine them
      if (mapCanvases.length > 1) {
        try {
          // Create a new canvas for the combined image
          const combinedCanvas = document.createElement("canvas");
          const ctx = combinedCanvas.getContext("2d");

          if (!ctx) {
            throw new Error("Could not get canvas context");
          }

          // Use the dimensions of the first canvas
          combinedCanvas.width = mapCanvases[0].width;
          combinedCanvas.height = mapCanvases[0].height;

          // Draw all canvases in order (base map first, then overlays)
          mapCanvases.forEach((canvas, index) => {
            try {
              ctx.drawImage(canvas, 0, 0);
              if (debugMode) {
                logger.info(
                  `Drew canvas ${index} (${canvas.id || canvas.className})`,
                );
              }
            } catch (e) {
              if (debugMode) {
                logger.warn(`Failed to draw canvas ${index}:`, e);
              }
            }
          });

          // Convert to data URL and download
          const imgData = combinedCanvas.toDataURL("image/png");
          downloadImage(imgData, filename);
          onStatusChange("Combined screenshot captured!");
          return true;
        } catch (err) {
          if (debugMode) {
            logger.error("Error combining multiple canvases:", err);
          }
          // Fall back to using just the first canvas
        }
      }

      // Use the first canvas found if combining failed
      const canvas = mapCanvases[0];

      try {
        // Try to get the data URL from the canvas
        const imgData = canvas.toDataURL("image/png");
        downloadImage(imgData, filename);
        onStatusChange("Screenshot captured (single canvas)!");
        return true;
      } catch (err) {
        if (debugMode) {
          logger.error("Error capturing canvas:", err);
        }

        // If we get a security error (CORS), we need to try a different approach
        if (err instanceof DOMException && err.name === "SecurityError") {
          onStatusChange(
            "Cannot access canvas due to security restrictions. Try using browser print instead.",
          );
          return false;
        }

        throw err;
      }
    }

    // If we couldn't find any suitable canvas, suggest using browser print
    onStatusChange("No map canvas found. Try using browser print instead.");

    // Open print dialog as a fallback
    if (
      confirm(
        "Would you like to open the browser print dialog to save the map as PDF?",
      )
    ) {
      window.print();
      return true;
    }

    return false;
  } catch (err) {
    logger.error("Error capturing map:", err);
    onStatusChange(
      `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
    return false;
  }
}

/**
 * Helper function to download an image from a data URL
 */
function downloadImage(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
