import { Download } from "flowbite-react-icons/outline";
import { Button } from "flowbite-react";
import { useDownloadDocument } from "@/features/common/providers/client-api.provider";

interface DownloadSignedDocumentProps {
  documentId?: string;
}

export default function DownloadSignedDocument({
  documentId, //= "c49faa70-fd56-4936-bb19-814c20a63266",
}: DownloadSignedDocumentProps) {
  const { content, isLoading } = useDownloadDocument(documentId);

  const handleDownload = () => {
    if (!content) return;

    // Create blob from base64 content
    const blob = new Blob([Buffer.from(content, "base64")], {
      type: "application/pdf",
    });
    const url = window.URL.createObjectURL(blob);

    // Create temporary link and trigger download
    const link = document.createElement("a");
    link.href = url;
    link.download = "document.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="flex items-center justify-center rounded-lg px-3 text-sm font-medium h-7">
      <Button
        className="group"
        outline
        color="blue"
        size="xs"
        onClick={handleDownload}
        disabled={isLoading}
      >
        <Download className="h-4 w-4 group-hover:text-white text-blue-700" />
      </Button>
    </div>
  );
}
