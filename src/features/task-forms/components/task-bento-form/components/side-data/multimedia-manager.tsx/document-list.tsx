import InnerContainer from "./inner-container";
import Document from "../document";
import { AlfrescoFileEntry } from "./image.types";

export default function DocumentList({
  setIsOpen,
  documents,
  setSelectedDocument,
}: {
  setIsOpen: (isOpen: boolean) => void;
  documents: any[];
  setSelectedDocument: (document: any) => void;
}) {
  return (
    <InnerContainer setIsOpen={setIsOpen} title="Documentos">
      <div className="flex flex-col gap-2 flex-grow overflow-y-auto">
        {documents.slice(0, 4).map((file: AlfrescoFileEntry) => (
          <Document
            key={file.entry.id}
            file={file}
            setSelected={setSelectedDocument}
          />
        ))}
      </div>
    </InnerContainer>
  );
}
