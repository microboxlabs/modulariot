"use client";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import TripInformation from "./components/trip-information/trip-information";
import TaskActions from "../task-actions/task-actions";
import { Button } from "flowbite-react";
import { FaMapPin, FaRegFilePdf } from "react-icons/fa";
import { GoClockFill } from "react-icons/go";
import { MdWindow } from "react-icons/md";
import DriverInfo from "./components/driver/driver";
import { GeographicHistoric } from "@/features/shipping/components/geographic-historic";
import { ShippingCoordinatorProcessForms } from "../../services/form.service.types";
import SideData from "./components/side-data/side-data";
import Conditions from "./components/side-data/conditions";
import FileImages from "./components/side-data/file-images";
import Geographic from "@/features/shipping/components/geographic";
import HistoricLoads from "@/features/shipping/components/historic-loads";
import SymptomsListSkeleton from "@/features/symptoms/components/symptoms-list/symptoms-list-skeleton";
import EmptyAnimation from "@/features/symptoms/components/empty-animation";
import ImageViewer from "@/features/geographic-view/components/image-viewer/image-viewer";
import { useState } from "react";

export default function Bento({
  lang,
  task,
  user,
  userGroups,
  msg,
  active,
}: {
  lang: string;
  task: TaskResponse;
  user: string;
  userGroups: string[];
  msg: I18nRecord;
  active: boolean;
}) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  const testImages = [
    "https://mintcargaimagenesprbfc3.blob.core.windows.net/mintral-catalogo-imagenes-prd/viaje/1484826/alerta_estiba/c9231598_1748475008514.jpeg",
    "https://mintcargaimagenesprbfc3.blob.core.windows.net/mintral-catalogo-imagenes-prd/viaje/1484826/alerta_estiba/c9231598_1748475008514.jpeg",
    "https://mintcargaimagenesprbfc3.blob.core.windows.net/mintral-catalogo-imagenes-prd/viaje/1484826/alerta_estiba/c9231598_1748475008514.jpeg",
    "https://mintcargaimagenesprbfc3.blob.core.windows.net/mintral-catalogo-imagenes-prd/viaje/1484826/alerta_estiba/c9231598_1748475008514.jpeg",
    "https://mintcargaimagenesprbfc3.blob.core.windows.net/mintral-catalogo-imagenes-prd/viaje/1484826/alerta_estiba/c9231598_1748475008514.jpeg",
  ];

  return (
    <div className="flex flex-col w-full h-full ">
      {/* Head */}
      <div className="bg-white dark:bg-gray-800 p-2 portrait:gap-2 flex flex-wrap justify-between">
        <div>
          <h1 className="text-md font-normal text-gray-700 dark:text-gray-200">
            Asignar Conductor/Transporte
          </h1>
          <h2 className="text-xs font-light text-gray-500 dark:text-gray-400">
            Estado de Proceso: Planificado
          </h2>
        </div>
        <div className="flex flex-row gap-1 w-full sm:w-auto">
          <Button
            color="gray"
            className="h-10 transition-all duration-100 z-20 bg-white dark:bg-gray-800 gap-2 w-fit hover:text-gray-500 portrait:hidden"
          >
            <div className="flex flex-row gap-2 items-center">
              <MdWindow className="w-5 h-5" width={30} height={30} />
            </div>
          </Button>
          <Button
            color="gray"
            className="h-10 transition-all duration-100 z-20 bg-white dark:bg-gray-800 gap-2 w-fit hover:text-gray-500"
          >
            <div className="flex flex-row gap-2 items-center">
              <GoClockFill className="w-5 h-5" width={30} height={30} />
              <p className="text-sm text-gray-900 dark:text-gray-100 lg:block hidden whitespace-nowrap">
                00:00:00
              </p>
            </div>
          </Button>
          <Button
            color="gray"
            className="h-10 transition-all duration-100 z-20 bg-white dark:bg-gray-800 gap-2 w-fit"
          >
            <div className="flex flex-row gap-2 items-center">
              <FaRegFilePdf className="w-5 h-5" width={20} height={20} />
              <p className="text-sm text-gray-900 dark:text-gray-100 lg:block hidden whitespace-nowrap">
                Carta Porte
              </p>
            </div>
          </Button>
          <TaskActions
            dict={
              (msg.pages as I18nRecord).transportValidationForm as I18nRecord
            }
            taskId={task.id}
            taskType={task.taskFormKey as ShippingCoordinatorProcessForms}
            lang={lang}
            fluid={true}
          />
        </div>
      </div>
      {/* Head */}

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 p-2 bg-gray-50">
        {/* Trip Information and Driver Info - side by side on portrait, separate on landscape */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          {/* Trip Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-300 dark:border-gray-700">
            <TripInformation
              task={task}
              msg={msg}
              lang={lang}
              userGroups={userGroups}
            />
          </div>

          {/* Driver Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-300 dark:border-gray-700">
            <DriverInfo task={task} msg={msg} />
          </div>
        </div>

        {/* Conditions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-300 dark:border-gray-700">
          <Conditions dict={msg as I18nRecord} />
        </div>

        {/* Geographic - spans full width below trip/driver on portrait, 2 columns on landscape */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg overflow-hidden sm:border border-gray-300 dark:border-gray-700 sm:min-h-[343px] min-h-fit">
          <div className="h-full w-full hidden sm:flex">
            <Geographic
              task={task}
              dictionary={msg as unknown as Record<string, string>}
            />
          </div>
          <div className="rounded-lg overflow-hidden sm:hidden bg-white dark:bg-gray-800">
            <Button className="w-full h-full" color="gray">
              <div className="flex flex-row gap-2 items-center">
                <FaMapPin />
                Abrir mapa
              </div>
            </Button>
          </div>
        </div>

        {/* File Images */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-300 dark:border-gray-700">
          <FileImages
            images={testImages.slice(0, 4)}
            setSelectedImage={setSelectedImage}
          />
        </div>

        {/* Historic Loads - spans full width */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg min-h-[343px]">
          <HistoricLoads
            task={task}
            dictionary={msg as unknown as Record<string, string>}
            active={active}
          />
        </div>

        {/* Forum */}
        <div className=" bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700">
          <div className="flex flex-col items-center justify-center h-full scale-90">
            <EmptyAnimation />
          </div>
        </div>
      </div>
      {/* Content */}

      {/* Image Viewer */}
      <ImageViewer
        images={testImages}
        selected={selectedImage}
        setSelected={setSelectedImage}
      />
    </div>
  );
}
