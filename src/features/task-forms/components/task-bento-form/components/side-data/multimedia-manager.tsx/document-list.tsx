import InnerContainer from "./inner-container";
import Document from "../document";

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
      <div className="grid grid-cols-1 gap-2 transition-all duration-300 rounded-lg overflow-y-auto relative h-fit">
        {documents.map((document: any) => (
          <Document
            key={document.file.entry.id}
            document={document}
            setSelected={setSelectedDocument}
          />
        ))}
      </div>
    </InnerContainer>
  );
}
