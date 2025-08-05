import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import { useEffect, useState } from "react";

export default function FileViewer({
  selected,
  setSelected,
}: {
  selected: any;
  setSelected: (selected: any) => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if device is mobile
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      const isSmallScreen = window.innerWidth <= 768;
      setIsMobile(isMobileDevice || isSmallScreen);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  useEffect(() => {
    if (selected && selected.startsWith("data:")) {
      // Convert data URL to blob URL
      const base64Data = selected.split(",")[1];
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
    } else {
      setBlobUrl(selected);
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
      window.open(blobUrl, '_blank');
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
            <iframe
              src={blobUrl}
              className="w-full h-full border-0"
              title="PDF Viewer"
            ></iframe>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p>Loading PDF...</p>
          </div>
        )}
      </div>
    </AbsoluteModal>
  );
}
