import { Download } from "flowbite-react-icons/outline";
import { Button } from "flowbite-react";
import Link from "next/link";
import { useVerifyDocument } from "@/features/common/providers/client-api.provider";

interface DownloadSignedDocumentProps {
  documentId?: string;
}

export default function DownloadSignedDocument({
  documentId,
}: DownloadSignedDocumentProps) {
  const documentPath = documentId?.replace(":/", "");
  const href = `/api/document/download?documentId=${documentPath}`;
  const uuid = documentId?.split("/");
  const { exists } = useVerifyDocument(uuid?.[uuid.length - 1] || "");

  return (
    <div className="flex items-start rounded-lg text-sm font-medium h-7">
      {exists ? (
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
      ) : (
        <Button className="group" outline color="blue" size="xs" disabled>
          <Download className="h-4 w-4 text-blue-700" />
        </Button>
      )}
    </div>
  );
}
