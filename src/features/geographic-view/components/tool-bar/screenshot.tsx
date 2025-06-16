import React, { useState } from "react";
import { FaCamera, FaDownload, FaShare } from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import { captureAndDownloadMap } from "../../utils/map-screenshot";
import { Button, Label } from "flowbite-react";

export default function Screenshot() {
  const [openScreenshot, setOpenScreenshot] = useState(false);
  const [_status, setStatus] = useState<string>("");
  const [_isCapturing, setIsCapturing] = useState(false);
  const [_showPreviewModal, setShowPreviewModal] = useState(false);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(
    null,
  );

  // Function to take a screenshot of the map and show in modal
  const handleScreenshot = async () => {
    setIsCapturing(true);
    setStatus("Preparing screenshot...");

    try {
      // First find the map canvases to create a preview
      const deckGLCanvas = document.querySelector(
        "canvas#deckgl-overlay",
      ) as HTMLCanvasElement;
      const mapboxCanvas = document.querySelector(
        "canvas.mapboxgl-canvas",
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
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsCapturing(false);
    }
  };

  // Function to share the screenshot (could be expanded)
  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation(); // Stop event from bubbling up
    // Basic share implementation (could be expanded)
    if (navigator.share && screenshotDataUrl) {
      navigator
        .share({
          title: "Previsualización de la vista geográfica",
          text: "Compartir la vista geográfica",
          //url: screenshotDataUrl, // TODO: Add this when we have a URL
          files: [
            new File([screenshotDataUrl], "vista-geografica.png", {
              type: "image/png",
            }),
          ],
        })
        .then(() => {
          setStatus("Screenshot shared!");
        })
        .catch((error) => {
          console.error("Share error:", error);
          setStatus("Error sharing screenshot");
        });
    } else {
      console.error("Sharing is not supported on this device/browser");
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
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      // Reset status after a delay
      setTimeout(() => {
        setStatus("");
      }, 2000);
    }
  };

  // Function to download directly from preview
  const downloadFromPreview = (e: React.MouseEvent) => {
    e.stopPropagation(); // Stop event from bubbling up
    if (screenshotDataUrl) {
      const link = document.createElement("a");
      link.download = `vista-geografica-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = screenshotDataUrl;
      link.click();
      setStatus("Screenshot saved!");
      // Close modal
      setShowPreviewModal(false);
    }
  };

  return (
    <div
      className={`border-2 border-gray-400 aspect-square h-8 w-8 rounded-md hover:border-blue-500 cursor-pointer pointer-events-auto flex items-center justify-center`}
      onClick={() => {
        handleScreenshot();
        setOpenScreenshot(!openScreenshot);
      }}
    >
      <FaCamera size={20} />
      {openScreenshot && (
        <div
          className="fixed bottom-0 left-0 right-0 top-0 z-50 w-full h-full pointer-events-none flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm cursor-pointer"
          onClick={() => setOpenScreenshot(false)}
        >
          <div
            className="flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-lg p-4 pointer-events-auto"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="w-full flex items-center flex-row gap-2 pb-4 text-gray-500 justify-between">
              <div className="w-full flex items-center gap-2 text-gray-500 justify-between">
                <h1 className="text-lg font-medium text-gray-900 dark:text-white">
                  Screenshot
                </h1>
              </div>
              <div
                onClick={() => {
                  setOpenScreenshot(false);
                }}
                className="flex flex-row text-gray-500 items-center gap-2 rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
              >
                <IoClose className="h-7 w-7" />
              </div>
            </div>
            <div>
              {/* Screenshot preview */}
              <div className="flex flex-col items-center justify-center space-y-4">
                {screenshotDataUrl && (
                  <div className="w-full overflow-auto border border-gray-200 rounded">
                    <img
                      src={screenshotDataUrl}
                      alt="Vista geográfica"
                      className="w-full h-auto"
                    />
                  </div>
                )}
                <div className="w-full flex flex-row gap-2">
                  <Label className="w-full flex text-left text-sm align-middle">
                    {`vista-geografica-${new Date().toISOString().slice(0, 10)}.png`}
                  </Label>
                  <div className="w-full flex justify-end gap-2">
                    <Button
                      color="blue"
                      onClick={(e: React.MouseEvent) => downloadFromPreview(e)}
                      pill
                      size="sm"
                    >
                      <FaDownload className="h-4 w-4 text-white text-center" />
                    </Button>
                    <Button
                      color="blue"
                      onClick={(e: React.MouseEvent) => handleShare(e)}
                      pill
                      size="sm"
                    >
                      <FaShare className="h-4 w-4 text-white text-center" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
