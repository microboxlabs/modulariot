import { Checkbox } from "flowbite-react";
import SelectorDropdown from "@/features/common/components/custom-dropdown/selector-dropdown";
import { FileType } from "./clasification-form";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

export default function LoadableDoc({
  selectedDocs,
  setSelectedDocs,
  categories,
  file,
  error,
  selectCategory,
  uploading,
  dictionary,
}: {
  selectedDocs: string[];
  setSelectedDocs: (docs: string[]) => void;
  categories: { value: string; label: string }[];
  file: FileType;
  error: boolean;
  selectCategory: (category: string) => void;
  uploading: boolean;
  dictionary: I18nRecord;
}) {
  return (
    <div
      className={`flex flex-col gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-2 w-full border transition-all duration-300 ${
        error ? "border-red-500" : "border-gray-200 dark:border-gray-700"
      }`}
    >
      <div className="text-sm text-gray-500 dark:text-gray-400 flex flex-row items-center justify-between">
        <div className="flex flex-row items-center gap-2">
          <Checkbox
            disabled={uploading}
            checked={selectedDocs.includes(file.name + "-" + file.lastModified)}
            onChange={(e) => {
              if (!e.target.checked) {
                setSelectedDocs(
                  selectedDocs.filter(
                    (doc) => doc !== file.name + "-" + file.lastModified,
                  ),
                );
              } else {
                setSelectedDocs([
                  ...selectedDocs,
                  file.name + "-" + file.lastModified,
                ]);
              }
            }}
          />
          <span>{file.name}</span>
        </div>
        {/*
          <div className="h-5 w-5 flex items-center justify-center">
            <FaTrash className="h-4 w-4 text-red-500 cursor-pointer hover:text-red-600" />
          </div>
        */}
      </div>
      {error && (
        <div className="text-red-500 text-xs font-light">
          {tr(
            "select_document_type_error",
            (dictionary.bento as I18nRecord).multimedia as I18nRecord,
          )}
        </div>
      )}
      <SelectorDropdown
        categories={categories}
        baseCategory={file.category}
        selectCategory={selectCategory}
        disabled={uploading}
        dictionary={dictionary}
      />
    </div>
  );
}
