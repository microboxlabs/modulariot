import { Button, Modal, ModalBody } from "flowbite-react";
import { MdOutlineFileDownload } from "react-icons/md";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { downloadImage } from "../../utils/download-image";

const modalTheme = {
  root: {
    base: "fixed inset-0 z-50 h-full w-full overflow-hidden",
    sizes: {
      "7xl": "max-w-none",
    },
  },
  content: {
    base: "relative w-[80%] h-[80%] md:h-[80%] p-0",
    inner:
      "relative flex flex-col h-full max-h-none bg-white dark:bg-gray-700 rounded-lg border border-gray-800 overflow-hidden",
  },
  body: {
    base: "flex flex-col flex-1 overflow-hidden p-0",
  },
};

export default function VideoViewer({
  videoUrl,
  show,
  onClose,
  dictionary,
}: Readonly<{
  videoUrl: string;
  show: boolean;
  onClose: () => void;
  dictionary: I18nRecord;
}>) {
  return (
    <Modal
      dismissible
      show={show}
      onClose={onClose}
      size="7xl"
      theme={modalTheme}
      className="z-[800] backdrop-blur-[10px]"
    >
      <ModalBody>
        <div className="relative flex items-center justify-center bg-gray-300 dark:bg-gray-600 rounded-t-lg shadow-lg w-full flex-1 min-h-0 overflow-hidden">
          <video
            src={videoUrl}
            controls
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
        </div>
        <div className="w-full flex-shrink-0 flex justify-end items-center p-2">
          <Button
            color="blue"
            onClick={async () => {
              try {
                await downloadImage(videoUrl, dictionary);
              } catch (error) {
                console.error("Download error:", error);
              }
            }}
            pill
            size="sm"
          >
            <MdOutlineFileDownload className="w-4 h-4" />
          </Button>
        </div>
      </ModalBody>
    </Modal>
  );
}
