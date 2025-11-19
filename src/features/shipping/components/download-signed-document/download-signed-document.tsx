"use client";

import { Download } from "flowbite-react-icons/outline";
import { Button } from "flowbite-react";
import Link from "next/link";
import { FaRegFilePdf } from "react-icons/fa";
//import { useVerifyDocument } from "@/features/common/providers/client-api.provider";

interface DownloadSignedDocumentProps {
  documentId?: string;
  asLink?: boolean;
  name: string;
}

export default function DownloadSignedDocument({
  documentId,
  asLink = false,
  name,
}: DownloadSignedDocumentProps) {
  const documentPath =
    documentId && typeof documentId?.replace === "function"
      ? documentId?.replace(":/", "")
      : documentId;

  const href = `/api/document/download?documentId=${documentPath}`;

  if (asLink) {
    return (
      <Button
        color="alternative"
        className="h-10 transition-all duration-100 z-10 gap-2 w-fit"
        as={Link}
        href={href}
      >
        <div className="flex flex-row gap-2 items-center">
          <FaRegFilePdf className="w-5 h-5" width={20} height={20} />
          <span className="lg:block hidden whitespace-nowrap">{name}</span>
        </div>
      </Button>
    );
  }

  return (
    <div className="flex items-start rounded-lg text-sm font-medium h-7 mr-2">
      {/* {exists ? ( */}
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
      {/*  ) : (
        <Button className="group" outline color="blue" size="xs" disabled>
          <Download className="h-4 w-4 text-blue-700" />
        </Button>
      )} */}
    </div>
  );
}
