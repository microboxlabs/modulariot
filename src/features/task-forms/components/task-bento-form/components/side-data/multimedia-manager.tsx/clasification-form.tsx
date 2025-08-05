import { Button, Checkbox } from "flowbite-react";
import LoadableDoc from "./loadable-doc";
import { useState, useEffect } from "react";
import SelectorDropdown from "@/features/common/components/custom-dropdown/selector-dropdown";
import InnerContainer from "./inner-container";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { postBentoMultimedia } from "@/features/common/providers/client-api.provider";
import { ShowNotification } from "@/features/notifications/notification";

export type FileType = {
  name: string;
  type: string;
  lastModified: number;
  category: string | null;
  file: File;
};

export type SendableFile = {
  filedata: File;
  prop_mintral_contentType: string;
  prop_cm_name: string;
  prop_mimetype: string;
  alf_destination: string;
};

export default function ClasificationForm({
  packageId,
  setIsOpen,
  uploadableFiles,
  dictionary,
  setUploadableFiles,
  mutate,
}: {
  packageId: string;
  setIsOpen: (isOpen: boolean) => void;
  uploadableFiles: any[];
  dictionary: I18nRecord;
  setUploadableFiles: (files: any[]) => void;
  mutate: () => void;
}) {
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [loadableDocs, setLoadableDocs] = useState<FileType[]>(
    uploadableFiles.map((file) => ({
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      category: null,
      file,
    })),
  );
  const [errorOnCondition, setErrorOnCondition] = useState<number[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const categories = getCategories(dictionary);

  useEffect(() => {
    if (loadableDocs.length === 0) {
      setIsOpen(false);
      setSelectedDocs([]);
    }
  }, [loadableDocs]);

  useEffect(() => {
    setLoadableDocs(
      uploadableFiles.map((file) => ({
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        category: null,
        file,
      })),
    );
  }, [uploadableFiles]);

  const handleUpload = async () => {
    let errors: number[] = [];

    loadableDocs.forEach((doc, index) => {
      if (doc.category === null) {
        errors.push(index);
      }
    });

    if (errors.length > 0) {
      setErrorOnCondition(errors);
      return;
    } else {
      setErrorOnCondition([]);
    }

    loadableDocs.forEach(async (doc) => {
      if (doc.category === null) {
        return;
      }

      setIsUploading(true);

      await postBentoMultimedia({
        filedata: doc.file as File,
        prop_mintral_contentType: doc.category,
        prop_cm_name: doc.name,
        prop_mimetype: doc.type,
        alf_destination: `workspace://SpacesStore/${packageId}`,
      })
        .then((_res) => {
          setIsUploading(false);
          ShowNotification({
            type: "success",
            message: "Archivo subido correctamente",
          });
          setIsOpen(false);
          mutate();
        })
        .catch((_err) => {
          ShowNotification({
            type: "error",
            message: "Error al subir el archivo",
          });
        });
    });
  };

  return (
    <InnerContainer
      setIsOpen={setIsOpen}
      title={
        <Checkbox
          disabled={isUploading}
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
      <div
        className={`flex flex-col gap-2 flex-grow overflow-y-auto border-2 border-dashed rounded-lg ${isDragOver ? "border-blue-500" : "border-transparent"}`}
        onDragEnter={(e) => {
          if (isUploading) {
            return;
          }
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragOver={(e) => {
          if (isUploading) {
            return;
          }
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          if (isUploading) {
            return;
          }
          e.preventDefault();
          setIsDragOver(false);
        }}
        onDrop={(e) => {
          if (isUploading) {
            return;
          }
          e.preventDefault();
          setIsDragOver(false);
          const files = Array.from(e.dataTransfer.files);
          const allowedTypes = [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "application/pdf",
          ];
          const validFiles = files.filter((file) =>
            allowedTypes.includes(file.type),
          );

          if (validFiles.length !== files.length) {
            alert(
              tr(
                "only_jpg_jpeg_png_pdf_allowed",
                ((dictionary as I18nRecord).bento as I18nRecord)
                  .multimedia as I18nRecord,
              ),
            );
            return;
          }

          setUploadableFiles([...uploadableFiles, ...validFiles]);
        }}
      >
        {loadableDocs.map((doc, index) => (
          <LoadableDoc
            key={doc.name + "-" + doc.lastModified}
            dictionary={dictionary}
            file={doc}
            selectedDocs={selectedDocs}
            setSelectedDocs={setSelectedDocs}
            categories={Object.values(categories)}
            error={errorOnCondition.includes(index)}
            uploading={isUploading}
            selectCategory={(category) => {
              setLoadableDocs(
                loadableDocs.map((loadableDoc) =>
                  loadableDoc.name + "-" + loadableDoc.lastModified ===
                  doc.name + "-" + doc.lastModified
                    ? { ...loadableDoc, category }
                    : loadableDoc,
                ),
              );
            }}
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
                  (loadableDoc: any) =>
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
            dictionary={dictionary}
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
            categories={Object.values(categories)}
          />
        </div>
        <Button
          className="w-full"
          color="blue"
          onClick={handleUpload}
          disabled={isUploading}
        >
          {isUploading ? "Subiendo..." : "Subir"}
        </Button>
      </div>
    </InnerContainer>
  );
}

export function getCategories(dict: I18nRecord) {
  return {
    PROOF_OF_DELIVERY: {
      value: "PROOF_OF_DELIVERY",
      label: tr(
        "PROOF_OF_DELIVERY",
        ((dict.bento as I18nRecord).multimedia as I18nRecord)
          .categories as I18nRecord,
      ),
    },
    PROOF_OF_PICKUP: {
      value: "PROOF_OF_PICKUP",
      label: tr(
        "PROOF_OF_PICKUP",
        ((dict.bento as I18nRecord).multimedia as I18nRecord)
          .categories as I18nRecord,
      ),
    },
    CARGO_MANIFEST: {
      value: "CARGO_MANIFEST",
      label: tr(
        "CARGO_MANIFEST",
        ((dict.bento as I18nRecord).multimedia as I18nRecord)
          .categories as I18nRecord,
      ),
    },
    OTHER: {
      value: "OTHER",
      label: tr(
        "OTHER",
        ((dict.bento as I18nRecord).multimedia as I18nRecord)
          .categories as I18nRecord,
      ),
    },
  };
}
