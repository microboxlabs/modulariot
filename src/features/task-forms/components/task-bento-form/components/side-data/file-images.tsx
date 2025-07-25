import { FileInput } from "flowbite-react";
import { ImageComponent } from "@/features/geographic-view/components/image-viewer/image-selector";
import Document from "./document";
import ImageViewer from "@/features/geographic-view/components/image-viewer/image-viewer";
import { useState } from "react";
import { IoDocumentTextOutline, IoImagesOutline } from "react-icons/io5";
import { FaUpload } from "react-icons/fa";

export default function FileImages() {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const images = [
    
    "https://mintcargaimagenesprbfc3.blob.core.windows.net/mintral-catalogo-imagenes-prd/viaje/1484826/alerta_estiba/c9231598_1748475008514.jpeg",
    "https://mintcargaimagenesprbfc3.blob.core.windows.net/mintral-catalogo-imagenes-prd/viaje/1484826/alerta_estiba/c9231598_1748475008514.jpeg",
    "https://mintcargaimagenesprbfc3.blob.core.windows.net/mintral-catalogo-imagenes-prd/viaje/1484826/alerta_estiba/c9231598_1748475008514.jpeg",
    "https://mintcargaimagenesprbfc3.blob.core.windows.net/mintral-catalogo-imagenes-prd/viaje/1484826/alerta_estiba/c9231598_1748475008514.jpeg",
    
    ];

  const documents = [
    
    {
      name: "Padrón",
      url: "",
    },
    {
      name: "Padrón",
      url: "",
    },
    {
      name: "Padrón",
      url: "",
    },
    {
      name: "Padrón",
      url: "",
    },
    
  ];

  return (
    <div
      className="h-full w-full flex flex-col relative"
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragOver(true);
        console.log("drag enter");
      }}
      onDragOver={(e) => {
        setIsDragOver(true);
        e.preventDefault(); // Required to allow drop
        console.log("drag over");
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        console.log("drag leave");
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        console.log("drop");
      }}
    >
      <div
        className={`absolute top-0 left-0 w-full h-full flex items-center justify-center rounded-lg bg-blue-500/40 z-20 transition-all duration-300 ${
          isDragOver ? "animate-fade-in-fast" : "animate-fade-out-fast"
        }`}
      ></div>
      <div
        className={`flex h-full w-full p-2 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed ${
          isDragOver
            ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
            : "border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-700"
        } ${
          images.length == 0 && documents.length == 0 ? "h-[650px]" : ""
        }`}
      >
        <div className="flex flex-col items-center justify-center pb-6 pt-5 gap-2">
          <p className="text-sm text-gray-500 dark:text-gray-100">
            Multimedia
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-bold text-gray-700 dark:text-gray-200">
              Drag and drop a file here or
            </span>
          </p>
          <div className="flex flex-row items-center justify-center gap-2 bg-blue-500 text-white p-2 rounded-lg text-sm font-light">
            <FaUpload className="w-3 h-3" /> Subir documento
          </div>
        </div>
        
        <FileInput id="dropzone-file" className="hidden" />

        {/* Images */}
        <div
          className={`gap-2 flex flex-col duration-300 rounded-lg relative mt-4 w-full ${
            images.length == 0 && documents.length == 0 ? "hidden" : "block"
          }`}
        >
          <div className="flex flex-row justify-between items-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Galeria ({images.length} elementos)
            </p>
            <div
              className={`${
                images.length == 0 ? "hidden" : "block"
              } text-sm text-blue-500 hover:underline cursor-pointer hover:decoration-dashed`}
            >
              Ver mas
            </div>
          </div>
          {images.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 transition-all duration-300 rounded-lg overflow-hidden relative h-80">
              {images.slice(0, 4).map((image, index) => (
                <ImageComponent
                  key={index}
                  image={image}
                  index={index}
                  setSelected={setSelectedImage}
                  setSize="h-40 w-full"
                  stepped={false}
                />
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400 h-80 flex flex-col items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg">
              <IoImagesOutline className="w-10 h-10" />
              No hay imagenes
            </div>
          )}
        </div>

        {/* Documents */}
        <div
          className={`gap-2 flex flex-col duration-300 rounded-lg relative mt-4 w-full ${
            documents.length == 0 && images.length == 0 ? "hidden" : "block"
          }`}
        >
          <div className="flex flex-row justify-between items-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Documentos ({documents.length} elementos)
            </p>
            <div
              className={`${
                documents.length == 0 ? "hidden" : "block"
              } text-sm text-blue-500 hover:underline cursor-pointer hover:decoration-dashed`}
            >
              Ver mas
            </div>
          </div>
          {
            documents.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 transition-all duration-300 rounded-lg overflow-hidden relative">
                {documents.map((document, index) => (
                  <Document key={index} name={document.name} />
                ))}
              </div>
            ) : (
              <div className="text-sm bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 h-[9.5rem] flex flex-col items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg">
                <IoDocumentTextOutline className="w-10 h-10" />
                No hay documentos
              </div>
            )
          }
        </div>
        {/* Image Viewer */}
        <ImageViewer
          images={images}
          selected={selectedImage}
          setSelected={setSelectedImage}
        />
      </div>
    </div>
  );
}
