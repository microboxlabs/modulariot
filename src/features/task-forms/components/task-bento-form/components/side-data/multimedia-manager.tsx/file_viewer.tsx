import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { getCategories } from "./clasification-form";
import { useEffect, useState } from "react";

export default function FileViewer({
  selected,
  setSelected,
  dictionary,
}: {
  selected: any;
  setSelected: (selected: any) => void;
  dictionary: I18nRecord;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const categories = getCategories(dictionary);
  useEffect(() => {
    // Check if device is mobile
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice =
        /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
          userAgent
        );
      const isSmallScreen = window.innerWidth <= 768;
      setIsMobile(isMobileDevice || isSmallScreen);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  useEffect(() => {
    if (selected && selected.url.startsWith("data:")) {
      const base64Data = selected.url.split(",")[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);

      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);

      // Cleanup function
      return () => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      };
    } else if (selected) {
      setBlobUrl(selected.url);
    }
  }, [selected]);

  useEffect(() => {
    // Cleanup blob URL when component unmounts
    return () => {
      if (blobUrl && blobUrl.startsWith("blob:")) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  const handleMobileOpen = () => {
    if (blobUrl) {
      window.open(blobUrl, "_blank");
      setSelected(null); // Close the modal
    }
  };

  if (blobUrl && isMobile) {
    handleMobileOpen();
    return null;
  }

  return (
    <AbsoluteModal selected={selected} setSelected={setSelected}>
      <div className="w-[80vw] h-[80vh]">
        {blobUrl ? (
          <div className="w-full h-full">
            <div className="w-full flex items-center justify-center py-1 gap-2">
              <div className="text-gray-600 dark:text-gray-300 rounded-full px-2 py-1">
                {selected?.name}
              </div>
              {selected?.tag && (
                <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-800 rounded-full px-2 py-1">
                  {categories[selected.tag as keyof typeof categories]?.label}
                </div>
              )}
            </div>
            <iframe
              src={blobUrl}
              className="w-full h-full border-0"
              title="PDF Viewer"
            ></iframe>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p>Loading PDF...</p>
          </div>
        )}
      </div>
    </AbsoluteModal>
  );
}
