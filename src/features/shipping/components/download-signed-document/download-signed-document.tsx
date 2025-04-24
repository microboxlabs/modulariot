import { Download } from "flowbite-react-icons/outline";
import { Button } from "flowbite-react";
import Link from "next/link";
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

  return (
    <>
      {asLink ? (
        <div className="flex items-center w-full mt-1">
          <Button
            outline
            as={Link}
            href={href}
            color="gray"
            className="h-10 transition-all duration-100 z-20 bg-white dark:bg-gray-800  gap-2 w-fit"
          >
            <Download className="h-5 w-5 dark:text-white mr-2" />{" "}
            {/* <p className="text-blue-700 dark:text-white hidden lg:block"> */}
            {name}
            {/* </p> */}
          </Button>
        </div>
      ) : (
        <div className="flex items-start rounded-lg text-sm font-medium h-7">
          {/* {exists ? ( */}
          <Button
            className="group"
            outline
            as={Link}
            color="blue"
            size="md"
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
      )}
    </>
  );
}
