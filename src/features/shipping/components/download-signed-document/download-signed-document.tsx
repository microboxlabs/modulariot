import { Button } from "flowbite-react";
import Link from "next/link";
import { FaRegFilePdf } from "react-icons/fa";
//import { useVerifyDocument } from "@/features/common/providers/client-api.provider";

interface DownloadSignedDocumentProps {
  documentId?: string;
  asLink?: boolean;
  name?: string;
}

export default function DownloadSignedDocument({
  documentId,
  asLink = false,
  name = "carta porte",
}: DownloadSignedDocumentProps) {
  const documentPath = documentId?.replace(":/", "");
  const href = `/api/document/download?documentId=${documentPath}`;
  //const uuid = documentId?.split("/");
  /* const { exists } = useVerifyDocument(uuid?.[uuid.length - 1] || ""); */

  if (asLink) {
    return (
      <Button
        color="gray"
        className="h-10 transition-all duration-100 z-20 gap-2 w-fit"
        as={Link}
        href={href}
      >
        <div className="flex flex-row gap-2 items-center">
          <FaRegFilePdf className="w-5 h-5" width={20} height={20} />
          <p className="text-sm text-gray-900 dark:text-gray-100 lg:block hidden whitespace-nowrap">
            {name}
          </p>
        </div>
      </Button>
    );
  }

  return (
    <Button
      color="gray"
      className="h-10 transition-all duration-100 z-20 gap-2 w-fit"
      href={href}
      as={Link}
      theme={{
        root: {
          className: "hover:bg-gray-500",
        },
      }}
    >
      <div className="flex flex-row gap-2 items-center">
        <FaRegFilePdf className="w-5 h-5" width={20} height={20} />
        <p className="text-sm text-gray-900 dark:text-gray-100 lg:block hidden whitespace-nowrap">
          {name}
        </p>
      </div>
    </Button>
  );
}
