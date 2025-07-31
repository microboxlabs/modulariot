import { Button, Checkbox } from "flowbite-react";
import LoadableDoc from "./loadable-doc";
import { useState, useEffect } from "react";
import SelectorDropdown from "@/features/common/components/custom-dropdown/selector-dropdown";
import InnerContainer from "./inner-container";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

export type FileType = {
  name: string;
  type: string;
  lastModified: number;
  category: string | null;
};

export default function ClasificationForm({
  setIsOpen,
  uploadableFiles,
  dictionary,
}: {
  setIsOpen: (isOpen: boolean) => void;
  uploadableFiles: any[];
  setUploadableFiles: (files: any[]) => void;
  dictionary: I18nRecord;
}) {
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [loadableDocs, setLoadableDocs] = useState<FileType[]>(
    uploadableFiles.map((file) => ({
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      category: null,
    })),
  );

  const categories = getCategories(dictionary);

  useEffect(() => {
    if (loadableDocs.length === 0) {
      setIsOpen(false);
      setSelectedDocs([]);
    }
  }, [loadableDocs]);

  return (
    <InnerContainer
      setIsOpen={setIsOpen}
      title={
        <Checkbox
          checked={selectedDocs.length > 0}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedDocs(
                loadableDocs.map((doc) => doc.name + "-" + doc.lastModified),
              );
            } else {
              setSelectedDocs([]);
            }
          }}
        />
      }
    >
      <div className="flex flex-col gap-2 flex-grow overflow-y-auto">
        {loadableDocs.map((doc) => (
          <LoadableDoc
            key={doc.name + "-" + doc.lastModified}
            file={doc}
            selectedDocs={selectedDocs}
            setSelectedDocs={setSelectedDocs}
            categories={categories}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <div
          className={`${selectedDocs.length > 0 ? "block" : "hidden"} flex flex-col gap-2`}
        >
          <Button
            className="w-full"
            color="red"
            onClick={() => {
              setLoadableDocs(
                loadableDocs.filter(
                  (loadableDoc) =>
                    !selectedDocs.includes(
                      loadableDoc.name + "-" + loadableDoc.lastModified,
                    ),
                ),
              );
              setSelectedDocs([]);
            }}
          >
            Eliminar Seleccionados
          </Button>
          <SelectorDropdown
            selectCategory={(category) => {
              setLoadableDocs(
                loadableDocs.map((loadableDoc) =>
                  selectedDocs.includes(
                    loadableDoc.name + "-" + loadableDoc.lastModified,
                  )
                    ? { ...loadableDoc, category }
                    : loadableDoc,
                ),
              );
            }}
            categories={categories}
          />
        </div>
        <Button className="w-full" color="blue">
          Subir
        </Button>
      </div>
    </InnerContainer>
  );
}

export function getCategories(dict: I18nRecord) {
  return [
    {
      value: "PROOF_OF_DELIVERY",
      label: tr(
        "PROOF_OF_DELIVERY",
        ((dict.bento as I18nRecord).multimedia as I18nRecord)
          .categories as I18nRecord,
      ),
    },
    {
      value: "PROOF_OF_PICKUP",
      label: tr(
        "PROOF_OF_PICKUP",
        ((dict.bento as I18nRecord).multimedia as I18nRecord)
          .categories as I18nRecord,
      ),
    },
    {
      value: "CARGO_MANIFEST",
      label: tr(
        "CARGO_MANIFEST",
        ((dict.bento as I18nRecord).multimedia as I18nRecord)
          .categories as I18nRecord,
      ),
    },
    {
      value: "OTHER",
      label: tr(
        "OTHER",
        ((dict.bento as I18nRecord).multimedia as I18nRecord)
          .categories as I18nRecord,
      ),
    },
  ];
}
