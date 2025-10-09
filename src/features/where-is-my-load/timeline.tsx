"use client";

import { FaTruck, FaTruckLoading } from "react-icons/fa";
import TimelineStates from "./components/state";
import React, { useEffect, useMemo } from "react";
import { Button, Spinner } from "flowbite-react";
import { useSearchParams } from "next/navigation";
import EmptyAnimation from "../symptoms/components/empty-animation";
import { I18nRecord } from "../i18n/i18n.service.types";
import { tr } from "../i18n/tr.service";
//import { ShowNotification } from "../notifications/notification";
import { useSearchLoad } from "../common/providers/client-api.provider";
import SearchScreen from "./search-screen";
import GenericComponent from "./components/state-components/generic";
import { LoadSearchResponse } from "./types/load.types";
import CustomCard from "@/features/common/components/custom-card/custom-card";
import LoadableLabel from "@/features/common/components/loadable-label/loadable-label";
import { HiExclamationCircle } from "react-icons/hi";
import type { InformationBadge } from "@/features/common/components/custom-card/custom-card";
import ModalTooltip from "@/features/shipping/components/modal-tooltip";

const getLoadIcon = (icon: string | null = "TRUCK_LOADING") => {
  if (icon === "TRUCK_LOADING") {
    return <FaTruckLoading className="h-6 w-6" />;
  }
  return <FaTruck className="h-6 w-6" />;
};

export type State = {
  name: string;
  icon: React.ReactElement | null;
  description?: string | React.ReactElement;
  ended: boolean;
  extradata: { [key: string]: string | number | boolean };
  time: {
    start: string | null;
    estimated_start: string | null;
    end: string | null;
    estimated_end: string | null;
    duration: number | null;
  };
  urgent: boolean;
  visible: boolean;
  enabled: boolean;
  task_id: string | null;
};

export default function Timeline({
  lang,
  userGroups,
  dict,
  messages,
}: {
  lang: string;
  userGroups: string[];
  dict: I18nRecord;
  messages: I18nRecord;
}) {
  const [actualState, setActualState] = React.useState(6);
  const [selectedTask, setSelectedTask] = React.useState<string | null>(null);

  const timelineRef = React.useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const loadId = searchParams.get("loadId");

  const { data, error, isLoading } = useSearchLoad(loadId ?? "");

  const states = useMemo(() => {
    return data && data.length > 0
      ? data?.map((item) => {
          return {
            name: item.nombre_etapa_,
            time: {
              start: item.start_time__,
              end: item.end_time__,
              estimated_start: item.base_start_time_,
              estimated_end: item.estimated_end_time_,
              duration: item.duration__,
            },
            icon: getLoadIcon(item.icon),
            description: getComponent(item),
            ended: item.end_time__ ? true : false,
            extradata: item.extradata,
            urgent: item.oferta_producto_ === "UR",
            visible: item.visible,
            enabled: item.enabled,
            task_id: item.task_id_ ?? null,
          };
        })
      : [];
  }, [data]);

  useEffect(() => {
    if (timelineRef.current) {
      const timelineContainer = timelineRef.current.querySelector(
        ".timeline-states-container"
      );
      if (timelineContainer && timelineContainer.children[actualState]) {
        timelineContainer.children[actualState].scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [actualState]);

  // Center on actualState when states are loaded (component initialization)
  useEffect(() => {
    if (timelineRef.current && states.length > 0) {
      const timelineContainer = timelineRef.current.querySelector(
        ".timeline-states-container"
      );
      if (timelineContainer && timelineContainer.children[actualState]) {
        timelineContainer.children[actualState].scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [states]);

  if (!loadId) {
    return (
      <SearchScreen
        dict={dict}
        messages={messages}
        searchParams={searchParams}
      />
    );
  }

  if (data && data.length === 0) {
    return (
      <div className="w-full h-full p-2 text-gray-900 dark:text-gray-100 flex flex-col justify-center items-center text-lg">
        <EmptyAnimation />
        <p className="text-lg text-gray-500 mt-10">
          {tr("wheres_my_load.not_found", dict as I18nRecord)}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        {error.message}
      </div>
    );
  }

  let urgent = true;

  const badges: InformationBadge[] = [];

  if (urgent) {
    badges.push({
      text: (dict.bento as I18nRecord).urgency as string,
      color: "purple" as const,
      icon: HiExclamationCircle,
    });
  }

  return (
    <div ref={timelineRef} className="w-fit h-fit flex flex-col md:flex-row">
      <ModalTooltip
        lang={lang}
        userGroups={userGroups}
        selectedTask={selectedTask}
        setSelectedTask={setSelectedTask}
        dict={dict}
      />
      <div className="absolute bottom-2 right-2 h-fit w-fit bg-amber-500 rounded-md p-2 hidden">
        <h1>Debug: {actualState}</h1>
        <div className="flex flex-col gap-2">
          <Button onClick={() => setActualState(Math.max(0, actualState - 1))}>
            -1
          </Button>
          <Button onClick={() => setActualState(actualState + 1)}>+1</Button>
        </div>
      </div>
      <div className="block md:hidden mb-4">
        <SideInfo badges={badges} />
      </div>

      <div className="w-fit h-full flex flex-col timeline-states-container">
        {states.map((state, index) => {
          if (state.urgent) {
            urgent = true;
          }

          if (!state.visible) {
            return null;
          }

          return (
            <TimelineStates
              key={index}
              index={index}
              count={states.length}
              actualState={actualState}
              state={state}
              statesCount={states.length}
              setSelectedTask={setSelectedTask}
            />
          );
        })}
      </div>
      <div className="hidden md:block sticky top-1/2 transform -translate-y-1/2 w-full h-fit ml-12">
        <SideInfo badges={badges} />
      </div>
    </div>
  );
}

function SideInfo({ badges }: { badges: InformationBadge[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 w-fit h-fit p-2">
      <CustomCard
        title="Información de la expedición"
        subtitle="Detalles"
        badges={badges}
        style={{ title: "text-lg", subtitle: "text-sm" }}
      >
        <div className="grid grid-cols-[max-content_max-content] gap-2">
          <LoadableLabel label="Código" value="3849494" />
          <LoadableLabel label="N° de expedición" value="999904361569" />
          <LoadableLabel label="Largo" value="130 cm" />
          <LoadableLabel label="Ancho" value="90 cm" />
          <LoadableLabel label="Alto" value="95 cm" />
          <LoadableLabel label="Volumen" value="9.78 m³" />
          <LoadableLabel label="Peso" value="2856 Kg" />
          <LoadableLabel label="Bultos" value="2" />
        </div>
      </CustomCard>
    </div>
  );
}

function getComponent(item: LoadSearchResponse) {
  // Here we add "State Id": Component
  const states_data: { [key: string]: () => React.ReactElement } = {};

  if (states_data[item.nombre_etapa_]) {
    return states_data[item.nombre_etapa_]();
  }

  return <GenericComponent item={item} />;
}
