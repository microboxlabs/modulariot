import { Checkbox } from "flowbite-react";
import SelectorDropdown from "@/features/common/components/custom-dropdown/selector-dropdown";
import { FileType } from "./clasification-form";

export default function LoadableDoc({
  selectedDocs,
  setSelectedDocs,
  categories,
  file,
}: {
  selectedDocs: string[];
  setSelectedDocs: (docs: string[]) => void;
  categories: { value: string; label: string }[];
  file: FileType;
}) {
  return (
    <div className="flex flex-col gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-2 w-full border border-gray-200 dark:border-gray-700">
      <div className="text-sm text-gray-500 dark:text-gray-400 flex flex-row items-center justify-between">
        <div className="flex flex-row items-center gap-2">
          <Checkbox
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
      <SelectorDropdown categories={categories} baseCategory={file.category} />
    </div>
  );
}
