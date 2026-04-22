import React, { useState } from "react";
import { createPortal } from "react-dom";
import { FaCamera, FaDownload, FaShare } from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import { Button, Label } from "flowbite-react";
import Image from "next/image";
import { handleScreenshot, shareScreenshot } from "./screenshot-utils";

export default function Screenshot() {
  const [openScreenshot, setOpenScreenshot] = useState(false);
  const [_status, setStatus] = useState<string>("");
  const [_isCapturing, setIsCapturing] = useState(false);
  const [_showPreviewModal, setShowPreviewModal] = useState(false);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(
    null
  );

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!screenshotDataUrl) return;
    try {
      const result = await shareScreenshot(
        screenshotDataUrl,
        `vista-geografica-${new Date().toISOString().slice(0, 10)}.png`,
        "Previsualización de la vista geográfica",
        "Compartir la vista geográfica",
      );
      if (result === "shared") setStatus("Screenshot shared!");
      else if (result === "unsupported") setStatus("Sharing is not supported on this device");
    } catch (error) {
      console.error("Share error:", error);
      setStatus("Error sharing screenshot");
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
        handleScreenshot(
          setIsCapturing,
          setStatus,
          setScreenshotDataUrl,
          setShowPreviewModal
        );
        setOpenScreenshot(!openScreenshot);
      }}
    >
      <FaCamera size={20} />
      {openScreenshot &&
        typeof globalThis !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] overflow-hidden pointer-events-none flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm cursor-pointer"
            onClick={() => setOpenScreenshot(false)}
          >
            <div
              className="flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-lg p-4 pointer-events-auto w-[90vw] h-[80vh] max-w-4xl max-h-[90vh]"
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
              <div className="flex flex-col grow overflow-hidden">
                {/* Screenshot preview */}
                <div className="flex flex-col flex-1 space-y-4 overflow-hidden">
                  {screenshotDataUrl && (
                    <div className="flex-1 w-full overflow-auto border border-gray-200 rounded min-h-0">
                      <Image
                        src={screenshotDataUrl}
                        alt="Vista geográfica"
                        width={800}
                        height={600}
                        className="w-full h-auto object-contain"
                      />
                    </div>
                  )}
                  <div className="flex-shrink-0 w-full flex flex-row gap-2">
                    <Label className="w-full flex text-left text-sm align-middle">
                      {`vista-geografica-${new Date().toISOString().slice(0, 10)}.png`}
                    </Label>
                    <div className="w-full flex justify-end gap-2">
                      <Button
                        color="blue"
                        onClick={(e: React.MouseEvent) =>
                          downloadFromPreview(e)
                        }
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
          </div>,
          document.body
        )}
    </div>
  );
}
