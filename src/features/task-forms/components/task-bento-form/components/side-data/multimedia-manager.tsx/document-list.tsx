import InnerContainer from "./inner-container";
import Document from "../document";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function DocumentList({
  setIsOpen,
  documents,
  setSelectedDocument,
  dictionary,
}: {
  setIsOpen: (isOpen: boolean) => void;
  documents: any[];
  setSelectedDocument: (document: any) => void;
  dictionary: I18nRecord;
}) {
  return (
    <InnerContainer setIsOpen={setIsOpen} title="Documentos">
      <div className="grid grid-cols-1 gap-2 transition-all duration-300 rounded-lg overflow-y-auto relative h-fit">
        {documents.map((document: any) => (
          <Document
            key={document.file.entry.id}
            document={document}
            setSelected={setSelectedDocument}
            dictionary={dictionary}
            modified={true}
          />
        ))}
      </div>
    </InnerContainer>
  );
}
