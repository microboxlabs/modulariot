import { FileInput, Label, TextInput } from "flowbite-react";
import { ImageComponent } from "@/features/geographic-view/components/image-selector";
import Document from "./document";

export default function FileImages() {
  return (
    <div className="h-full w-full flex flex-col">
      {/* Update of files */}
            <div className="flex w-full items-center justify-center flex-1">
          <Label
          htmlFor="dropzone-file"
          className="flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-600"
        >
          <div className="flex flex-col items-center justify-center pb-6 pt-5">
            <p className="mb-2 text-sm text-gray-500 dark:text-gray-100">
              Multimedia
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-bold text-gray-700 dark:text-gray-200">
                Drag and drop
              </span>{" "}
              a file here or{" "}
              <span className="font-bold text-gray-700 dark:text-gray-200">
                click
              </span>{" "}
              to upload
            </p>
          </div>
          <FileInput id="dropzone-file" className="hidden" />
        </Label>
    </div>

    {/* Images */}
    <div className="gap-2 flex flex-col duration-300 rounded-lg relative mt-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Galeria (12 elementos)
      </p>
      <div className="grid grid-cols-2 gap-2 transition-all duration-300 rounded-lg overflow-hidden relative">
        <ImageComponent
          image={null}
          index={0}
          setSelected={() => {}}
          setSize="h-40 w-full"
          stepped={false}
        />
        <ImageComponent
          image={null}
          index={0}
          setSelected={() => {}}
          setSize="h-40 w-full"
          stepped={false}
        />
        <ImageComponent
          image={null}
          index={0}
          setSelected={() => {}}
          setSize="h-40 w-full"
          stepped={false}
        />
        <ImageComponent
          image={null}
          index={0}
          setSelected={() => {}}
          setSize="h-40 w-full"
          stepped={false}
        />
      </div>
    </div>

    {/* Documents */}
    <div className="gap-2 flex flex-col duration-300 rounded-lg relative mt-4">
        <div className="flex flex-row justify-between items-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Documentos (12 elementos)
          </p>
          <div className="text-sm text-blue-500 hover:underline cursor-pointer hover:decoration-dashed">
            Ver mas
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 transition-all duration-300 rounded-lg overflow-hidden relative">
          <Document />
          <Document />
          <Document />
          <Document />
        </div>
      </div>
  </div>

  );
}