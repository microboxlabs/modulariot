import { Camera, Download, Share } from 'lucide-react';
import CustomBaseButton from "../../../../../../buttons/custom-base-button";
import { captureAndDownloadMap } from "../../../../../utils/map-screenshot";
import { useState } from "react"
import ScreenshotModal from './screenshot-modal';

export default function Screenshot() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(
    null
  );

  // Function to take a screenshot of the map and show in modal
  const handleScreenshot = async () => {
    setIsCapturing(true);
    setStatus("Preparing screenshot...");

    try {
      // First find the map canvases to create a preview
      const deckGLCanvas = document.querySelector(
        "canvas#deckgl-overlay"
      ) as HTMLCanvasElement;
      const mapboxCanvas = document.querySelector(
        "canvas.mapboxgl-canvas"
      ) as HTMLCanvasElement;

      if (mapboxCanvas && deckGLCanvas) {
        // Create a new canvas for the combined image
        const combinedCanvas = document.createElement("canvas");
        const ctx = combinedCanvas.getContext("2d");

        if (!ctx) {
          throw new Error("Could not get canvas context");
        }

        // Use the dimensions of the Mapbox canvas
        combinedCanvas.width = mapboxCanvas.width;
        combinedCanvas.height = mapboxCanvas.height;

        // First draw the Mapbox map (base layer)
        ctx.drawImage(mapboxCanvas, 0, 0);

        // Then draw the DeckGL overlay (pins, markers, etc.)
        ctx.drawImage(deckGLCanvas, 0, 0);

        // Get the data URL for preview
        const imgData = combinedCanvas.toDataURL("image/png");
        setScreenshotDataUrl(imgData);
        setShowPreviewModal(true);
      } else {
        // If we can't get canvases for preview, try the regular download
        await downloadScreenshot();
      }
    } catch (error) {
      console.error("Screenshot preview error:", error);
      setStatus(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsCapturing(false);
    }
  };

  // Function to download the screenshot
  const downloadScreenshot = async () => {
    setStatus("Downloading screenshot...");

    try {
      // Use the native map screenshot approach with combined canvases
      const success = await captureAndDownloadMap({
        filename: `map-screenshot-${new Date().toISOString().slice(0, 10)}.png`,
        fileType: "image/png",
        debugMode: true, // Keep debug mode enabled temporarily
        onStatusChange: (newStatus) => {
          setStatus(newStatus);
        },
      });

      if (!success) {
        setStatus("Failed to capture screenshot");
        console.error("Screenshot capture failed");
      } else {
        setStatus("Screenshot saved!");
        // Close the modal if it was open
        setShowPreviewModal(false);
      }
    } catch (error) {
      console.error("Screenshot error:", error);
      setStatus(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      // Reset status after a delay
      setTimeout(() => {
        setStatus("");
      }, 2000);
    }
  };

  return (
    <div>
      <CustomBaseButton
        onClick={handleScreenshot}
        disabled={isCapturing}
      >
        <Camera className="h-4 w-4 mr-2"/>
        Screenshot
      </CustomBaseButton>
      {/* Preview Modal */}
      <ScreenshotModal
        status={status}
        showPreviewModal={showPreviewModal}
        screenshotDataUrl={screenshotDataUrl}
        setShowPreviewModal={setShowPreviewModal}
        setStatus={setStatus}
      />
    </div>
  )
}