import { Download } from "flowbite-react-icons/outline";
import { Button } from "flowbite-react";
import Link from "next/link";

interface DownloadSignedDocumentProps {
  documentId?: string;
}

export default function DownloadSignedDocument({
  documentId,
}: DownloadSignedDocumentProps) {
  const documentPath = documentId?.replace(":/", "");
  const href = `/api/document/download?documentId=${documentPath}`;

  return (
    <div className="flex items-start rounded-lg text-sm font-medium h-7">
      <Button
        className="group"
        outline
        as={Link}
        color="blue"
        size="xs"
        href={href}
      >
        <Download className="h-4 w-4 text-blue-700" />
      </Button>
    </div>
  );
}
