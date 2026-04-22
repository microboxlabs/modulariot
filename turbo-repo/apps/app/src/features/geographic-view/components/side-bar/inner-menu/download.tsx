import {
  Button,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "flowbite-react";
import { FaCamera } from "react-icons/fa6";
import { FaDownload, FaShare } from "react-icons/fa";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useState } from "react";
import DownloadCSV from "./components/download_csv";
import { MapPosition } from "@/features/geographic-view/types/map";
import { handleScreenshot, shareScreenshot } from "../../tool-bar/screenshot-utils";

export default function Download({
  dict,
  mapPositions,
}: {
  dict: I18nRecord;
  mapPositions: MapPosition[];
}) {
  const [status, setStatus] = useState<string>("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(
    null
  );

  // Function to download directly from preview
  const downloadFromPreview = () => {
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

  const handleShare = async () => {
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

  return (
    <div className="w-full flex flex-col gap-4">
      <Label className="w-full flex text-left text-lg">
        {(dict.symptoms as I18nRecord).downloadable_elements as string}
      </Label>
      <div className="w-full flex flex-col gap-2">
        <Button
          color="blue"
          className="flex align-middle justify-center"
          onClick={() => {
            handleScreenshot(
              setIsCapturing,
              setStatus,
              setScreenshotDataUrl,
              setShowPreviewModal
            );
          }}
          disabled={isCapturing}
        >
          <FaCamera className="h-4 w-4 mr-2" />{" "}
          {isCapturing
            ? status || "..."
            : ((dict.symptoms as I18nRecord).screenshot as string)}
        </Button>
        <DownloadCSV dict={dict} mapPositions={mapPositions} />
        {/* 
        <Button color="blue" className="flex align-middle justify-center">
          <FaRegFile className="h-4 w-4 mr-2" />{" "}
          {(dict.symptoms as I18nRecord).other as string}
        </Button> */}
      </div>

      {/* Preview Modal */}
      <Modal
        dismissible
        show={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        size="2xl"
      >
        <ModalHeader>
          {
            ((dict.symptoms as I18nRecord).document_preview ||
              "Previsualización del documento") as string
          }
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col items-center justify-center space-y-4">
            {/* Screenshot preview */}
            {screenshotDataUrl && (
              <div className="w-full overflow-auto border border-gray-200 rounded">
                <img
                  src={screenshotDataUrl}
                  alt="Vista geográfica"
                  className="w-full h-auto"
                />
              </div>
            )}

            {/* Status message */}
            {status && (
              <div className="w-full text-center text-sm text-gray-500">
                {status}
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="w-full flex flex-col gap-2">
            <Label className="w-full flex text-left text-sm">
              {`vista-geografica-${new Date().toISOString().slice(0, 10)}.png`}
            </Label>
          </div>
          <div className="w-full flex justify-end gap-2">
            <Button color="blue" onClick={downloadFromPreview} pill size="sm">
              <FaDownload className="h-4 w-4 text-white text-center" />
            </Button>
            <Button color="blue" onClick={handleShare} pill size="sm">
              <FaShare className="h-4 w-4 text-white text-center" />
            </Button>
          </div>
        </ModalFooter>
      </Modal>
    </div>
  );
}
