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

  return (
    <AbsoluteModal selected={selected} setSelected={setSelected}>
      <div className="w-full h-full">
        {blobUrl ? (
          <iframe
            src={blobUrl}
            className="w-full h-full border-0"
            title="PDF Viewer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p>Loading PDF...</p>
          </div>
        )}
      </div>
    </AbsoluteModal>
  );
}
