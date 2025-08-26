import { Button, Label, Modal, ModalHeader, ModalBody, ModalFooter } from "flowbite-react";
import { Download, Share } from 'lucide-react';
import CustomBaseButton from "../../../../../../buttons/custom-base-button";

export default function ScreenshotModal(
  {
    status,
    showPreviewModal,
    screenshotDataUrl,
    setShowPreviewModal,
    setStatus
  }: {
    status: string;
    showPreviewModal: boolean;
    screenshotDataUrl: string | null;
    setShowPreviewModal: (show: boolean) => void;
    setStatus: (status: string) => void;
  }
) {
  

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

  // Function to share the screenshot (could be expanded)
  const handleShare = () => {
    // Basic share implementation (could be expanded)
    if (navigator.share && screenshotDataUrl) {
      navigator
        .share({
          title: "Previsualización de la vista geográfica",
          text: "Compartir la vista geográfica",
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

  return (
    <Modal
      dismissible
      show={showPreviewModal}
      onClose={() => setShowPreviewModal(false)}
      size="2xl"
      className="backdrop-blur-lg"
      theme={{
        "content": {
          "inner": "relative flex max-h-[90dvh] flex-col rounded-lg bg-white shadow dark:bg-slate-900"
        }
      }}
    >
      <ModalHeader>
        {
          "Previsualización del documento"
        }
      </ModalHeader>
      <ModalBody className="!p-0">
        <div className="flex flex-col items-center justify-center space-y-4">
          {/* Screenshot preview */}
          {screenshotDataUrl && (
            <div className="w-full">
              <img
                src={screenshotDataUrl}
                alt="Vista geográfica"
                className="w-full h-auto"
              />
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter className="!p-4">
        <div className="w-full flex flex-col gap-2">
          <Label className="w-full flex text-left text-sm">
            {`vista-geografica-${new Date().toISOString().slice(0, 10)}.png`}
          </Label>
        </div>
        <div className="w-full flex justify-end gap-2">
          <CustomBaseButton
            onClick={downloadFromPreview}
            fit
          >
            <Download className="h-4 w-4" />
          </CustomBaseButton>
          <CustomBaseButton
            onClick={handleShare}
            fit
          >
            <Share className="h-4 w-4" />
          </CustomBaseButton>
        </div>
      </ModalFooter>
    </Modal>
  );
}