import { Button, Checkbox } from "flowbite-react";
import LoadableDoc from "./file-viewer/loadable-doc";
import { useState, useEffect } from "react";
import SelectorDropdown from "@/features/common/components/custom-dropdown/selector-dropdown";
import InnerContainer from "./gallery/inner-container";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
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
  uploadFile,
  onUploadComplete,
}: {
  packageId: string;
  setIsOpen: (isOpen: boolean) => void;
  uploadableFiles: any[];
  dictionary: I18nRecord;
  setUploadableFiles: (files: any[]) => void;
  uploadFile: (file: SendableFile, skipRevalidation?: boolean) => Promise<any>;
  onUploadComplete: () => void;
}) {
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [loadableDocs, setLoadableDocs] = useState<FileType[]>(
    uploadableFiles.map((file) => ({
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      category: null,
      file,
    }))
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
      }))
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

    setIsUploading(true);
    setIsOpen(false);

    const docsToUpload = loadableDocs.filter((doc) => doc.category !== null);

    // Wrap sequential uploads in a promise for the notification
    const uploadPromise = (async () => {
      for (let i = 0; i < docsToUpload.length; i++) {
        const doc = docsToUpload[i];
        const isLast = i === docsToUpload.length - 1;
        // Skip revalidation for all but the last file
        await uploadFile(
          {
            filedata: doc.file as File,
            prop_mintral_contentType: doc.category!,
            prop_cm_name: doc.name,
            prop_mimetype: doc.type,
            alf_destination: `workspace://SpacesStore/${packageId}`,
          },
          !isLast
        );
      }
    })();

    ShowNotification({
      type: "promise",
      promise: uploadPromise,
      loading: tr("bento.multimedia.upload_loading", dictionary),
      ok: tr("bento.multimedia.upload_success", dictionary),
      error: tr("bento.multimedia.upload_error", dictionary),
    });

    uploadPromise
      .catch(() => {
        // Error already shown via notification — don't reopen the form
      })
      .finally(() => {
        onUploadComplete();
        setIsUploading(false);
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
                loadableDocs.map((doc) => doc.name + "-" + doc.lastModified)
              );
            } else {
              setSelectedDocs([]);
            }
          }}
        />
      }
    >
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
                      loadableDoc.name + "-" + loadableDoc.lastModified
                    )
                )
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
                    loadableDoc.name + "-" + loadableDoc.lastModified
                  )
                    ? { ...loadableDoc, category }
                    : loadableDoc
                )
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
      <div
        className={`flex flex-col gap-2 grow overflow-y-auto border-2 border-dashed rounded-lg ${isDragOver ? "border-blue-500" : "border-transparent"}`}
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
            allowedTypes.includes(file.type)
          );

          if (validFiles.length !== files.length) {
            alert(
              tr(
                "only_jpg_jpeg_png_pdf_allowed",
                ((dictionary as I18nRecord).bento as I18nRecord)
                  .multimedia as I18nRecord
              )
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
            selectCategory={(category: string) => {
              setLoadableDocs(
                loadableDocs.map((loadableDoc) =>
                  loadableDoc.name + "-" + loadableDoc.lastModified ===
                  doc.name + "-" + doc.lastModified
                    ? { ...loadableDoc, category }
                    : loadableDoc
                )
              );
            }}
          />
        ))}
      </div>
    </InnerContainer>
  );
}

export function getCategories(dict: I18nRecord) {
  return {
    PROOF_OF_DELIVERY: {
      value: "PROOF_OF_DELIVERY",
      label: tr("bento.multimedia.categories.PROOF_OF_DELIVERY", dict),
    },
    PROOF_OF_LOAD_FLOOR: {
      value: "PROOF_OF_LOAD_FLOOR",
      label: tr("bento.multimedia.categories.PROOF_OF_LOAD_FLOOR", dict),
    },
    PROOF_OF_PICKUP: {
      value: "PROOF_OF_PICKUP",
      label: tr("bento.multimedia.categories.PROOF_OF_PICKUP", dict),
    },
    PROOF_OF_LOAD_RECEIPT: {
      value: "PROOF_OF_LOAD_RECEIPT",
      label: tr("bento.multimedia.categories.PROOF_OF_LOAD_RECEIPT", dict),
    },
    CARGO_MANIFEST: {
      value: "CARGO_MANIFEST",
      label: tr("bento.multimedia.categories.CARGO_MANIFEST", dict),
    },
    PICKUP_FRONT_IMAGE: {
      value: "PICKUP_FRONT_IMAGE",
      label: tr("bento.multimedia.categories.PICKUP_FRONT_IMAGE", dict),
    },
    PICKUP_RIGHT_IMAGE: {
      value: "PICKUP_RIGHT_IMAGE",
      label: tr("bento.multimedia.categories.PICKUP_RIGHT_IMAGE", dict),
    },
    PICKUP_LEFT_IMAGE: {
      value: "PICKUP_LEFT_IMAGE",
      label: tr("bento.multimedia.categories.PICKUP_LEFT_IMAGE", dict),
    },
    PICKUP_REAR_IMAGE: {
      value: "PICKUP_REAR_IMAGE",
      label: tr("bento.multimedia.categories.PICKUP_REAR_IMAGE", dict),
    },
    PICKUP_GUIDE_IMAGE: {
      value: "PICKUP_GUIDE_IMAGE",
      label: tr("bento.multimedia.categories.PICKUP_GUIDE_IMAGE", dict),
    },
    OTHER: {
      value: "OTHER",
      label: tr("bento.multimedia.categories.OTHER", dict),
    },
  };
}
