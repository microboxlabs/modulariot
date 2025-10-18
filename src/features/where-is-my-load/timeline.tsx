"use client";

import { FaTruck, FaTruckLoading } from "react-icons/fa";
import TimelineStates, {
  TemporalComponent,
  DelayCalculations,
} from "./components/state";
import React, { useEffect, useMemo } from "react";
import { Button, Spinner } from "flowbite-react";
import { useSearchParams } from "next/navigation";
import EmptyAnimation from "../symptoms/components/empty-animation";
import { I18nRecord } from "../i18n/i18n.service.types";
import { tr } from "../i18n/tr.service";
//import { ShowNotification } from "../notifications/notification";
import { useSearchLoad } from "../common/providers/client-api.provider";
import SearchScreen from "./search-screen";
import { LoadSearchResponse } from "@/types/load.types";
import CustomCard from "@/features/common/components/custom-card/custom-card";
import LoadableLabel from "@/features/common/components/loadable-label/loadable-label";
import { HiExclamationCircle } from "react-icons/hi";
import type { InformationBadge } from "@/features/common/components/custom-card/custom-card";
import ModalTooltip from "@/features/shipping/components/modal-tooltip";
import GenericComponent from "./components/state-components/generic";
import FormattedDate from "../common/components/formatted-date";
import { fromString } from "../common/services/days.service";

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
    projected_start: string | null;
    end: string | null;
    projected_end: string | null;
    lead_time_start: string | null;
    lead_time_end: string | null;
    duration: number | null;
  };
  visible: boolean;
  enabled: boolean;
  task_id: string | null;
  urgency: boolean;
  expedition: {
    code: number | null;
    number: number | null;
  };
  oferta_producto?: string | null;
  origin?: string | null;
  destination?: string | null;
};

export default function Timeline({
  lang,
  userGroups,
  dict,
  messages,
  debug = false,
}: {
  lang: string;
  userGroups: string[];
  dict: I18nRecord;
  messages: I18nRecord;
  debug?: boolean;
}) {
  const [actualState, setActualState] = React.useState(6);
  const [selectedTask, setSelectedTask] = React.useState<string | null>(null);
  const [debugPos, setDebugPos] = React.useState<{
    top: number;
    left: number;
  } | null>(null);

  const timelineRef = React.useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const expeditionCode = searchParams.get("expeditionCode") || undefined;
  const expeditionNumber = searchParams.get("expeditionNumber") || undefined;

  const { data, error, isLoading } = useSearchLoad(
    expeditionCode,
    expeditionNumber
  );

  const states = useMemo(() => {
    return data && data.length > 0
      ? data?.map((item) => {
          return {
            name: item.nombre_etapa_,
            time: {
              start: item.start_time__,
              end: item.end_time__,
              projected_start: item.projected_start_time_,
              projected_end: item.projected_end_time_,
              lead_time_start: item.start_lead_time_,
              lead_time_end: item.end_lead_time_,
              duration: item.duration__,
            },
            icon: getLoadIcon(item.icon),
            description: getComponent(item),
            ended: item.end_time__ ? true : false,
            extradata: item.extradata,
            urgency: item.urgency,
            visible: item.visible,
            enabled: item.enabled,
            task_id: item.task_id_ ?? null,
            expedition: {
              code: item.expe_codigo_,
              number: item.expe_numero_,
            },
            oferta_producto: item.oferta_producto_ ?? null,
            origin: item.origen ?? null,
            destination: item.destino ?? null,
          };
        })
      : [];
  }, [data]);

  // Calculate actualState based on completed tasks
  useEffect(() => {
    if (data && data.length > 0) {
      for (let i = 0; i < data.length; i++) {
        if (data[i].start_time__) {
          setActualState(i);
        }
      }
    }
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
    // Update debug element position when actual state changes
    if (debug) {
      updateDebugPosition();
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
    if (debug) {
      updateDebugPosition();
    }
  }, [states]);

  // Helper to update debug position tracking the active timeline state
  const updateDebugPosition = React.useCallback(() => {
    if (!timelineRef.current) return;
    const container = timelineRef.current.querySelector(
      ".timeline-states-container"
    ) as HTMLDivElement | null;
    if (!container) return;
    const activeEl = container.children[actualState] as HTMLElement | undefined;
    if (!activeEl) return;
    const rect = activeEl.getBoundingClientRect();
    // Use viewport coordinates with position: fixed
    setDebugPos({ top: rect.top, left: rect.right + 16 });
  }, [actualState]);

  // Attach scroll / resize listeners to keep debug panel aligned while scrolling
  useEffect(() => {
    if (!debug) return;
    const handleScroll = () => updateDebugPosition();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    // Initial position
    updateDebugPosition();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [debug, updateDebugPosition]);

  const badges: InformationBadge[] = useMemo(() => {
    const badgeList: InformationBadge[] = [];

    states.forEach((state, index) => {
      if (state.urgency && index == actualState) {
        badgeList.push({
          text: (dict.bento as I18nRecord).urgency as string,
          color: "purple" as const,
          icon: HiExclamationCircle,
        });
      }
    });

    return badgeList;
  }, [states, actualState, dict]);

  if (!expeditionCode && !expeditionNumber) {
    return (
      <SearchScreen
        dict={dict}
        messages={messages}
        searchParams={searchParams}
      />
    );
  }

  if ((data && data.length === 0) || (error && (error as any).status === 404)) {
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

  // Validate expeditionCode and expeditionNumber after all hooks have executed to satisfy rules-of-hooks
  const invalidExpeditionCode =
    expeditionCode != null && !/^[0-9]+$/.test(expeditionCode);
  const invalidExpeditionNumber =
    expeditionNumber != null && !/^[0-9]+$/.test(expeditionNumber);
  if (invalidExpeditionCode || invalidExpeditionNumber) {
    return (
      <div className="w-full h-full p-2 text-gray-900 dark:text-gray-100 flex flex-col justify-center items-center text-lg">
        <EmptyAnimation />
        <p className="text-lg text-gray-500 mt-10">
          {tr("wheres_my_load.not_found", dict as I18nRecord)}
        </p>
      </div>
    );
  }

  return (
    <div ref={timelineRef} className="w-fit h-fit flex flex-col xl:flex-row">
      <ModalTooltip
        lang={lang}
        userGroups={userGroups}
        selectedTask={selectedTask}
        setSelectedTask={setSelectedTask}
        dict={dict}
        isFinished={true}
      />
      {debug && (
        <div
          className="h-fit w-fit bg-amber-500 rounded-md p-2 shadow-lg border border-amber-600"
          style={{
            position: "fixed",
            top: debugPos ? debugPos.top : undefined,
            left: debugPos ? debugPos.left : undefined,
            zIndex: 1000,
          }}
        >
          <h1 className="font-semibold">Debug: {actualState}</h1>
          <div className="flex flex-col gap-2">
            <Button
              size="xs"
              onClick={() => setActualState(Math.max(0, actualState - 1))}
            >
              -1
            </Button>
            <Button size="xs" onClick={() => setActualState(actualState + 1)}>
              +1
            </Button>
          </div>
        </div>
      )}
      <div className="block xl:hidden mb-4 w-full">
        <SideInfo
          badges={badges}
          item={data ? data[actualState] : undefined}
          state={states[actualState]}
          dict={dict}
          className="w-full"
        />
      </div>

      <div className="w-fit h-full flex flex-col timeline-states-container">
        {states.map((state, index) => {
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
              dict={dict}
            />
          );
        })}
      </div>
      <div className="hidden xl:block sticky top-1/2 transform -translate-y-1/2 w-full h-fit ml-12">
        <SideInfo
          badges={badges}
          item={data ? data[actualState] : undefined}
          state={states[actualState]}
          dict={dict}
        />
      </div>
    </div>
  );
}

function SideInfo({
  badges,
  item,
  state,
  dict,
  className = "",
}: {
  badges: InformationBadge[];
  item: LoadSearchResponse | undefined;
  state: State;
  dict: I18nRecord;
  className?: string;
}) {
  const temporal_data = TemporalComponent({ time: state.time, dict });

  return (
    <div className={`w-fit h-fit flex flex-col gap-2 ${className}`}>
      <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 w-full h-fit">
        <CustomCard
          title={tr("wheres_my_load.expedition_info", dict)}
          subtitle={null}
          style={{ title: "text-xl", subtitle: "text-sm" }}
        >
          <div className="grid grid-cols-[max-content_max-content] gap-2">
            <LoadableLabel
              label="Código"
              value={state.expedition.code ?? "-"}
              className="!text-base"
            />
            <LoadableLabel
              label="N° de expedición"
              value={state.expedition.number ?? "-"}
              className="!text-base"
            />
            <LoadableLabel
              label="Origen"
              value={state.origin ?? "-"}
              className="!text-base"
            />
            <LoadableLabel label="Volumen" value="-" className="!text-base" />
            <LoadableLabel
              label="Destino"
              value={state.destination ?? "-"}
              className="!text-base"
            />
            <LoadableLabel label="Peso" value="-" className="!text-base" />
            <LoadableLabel
              label="Oferta producto"
              value={state.oferta_producto ?? "-"}
              className="!text-base"
            />
            <LoadableLabel label="Bultos" value="-" className="!text-base" />
          </div>
        </CustomCard>
      </div>
      <DelayCalculations temporalData={temporal_data} dict={dict} />
      <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 w-full h-fit">
        <CustomCard
          title={state.name}
          subtitle={null}
          style={{ title: "text-xl", subtitle: "text-sm" }}
          badges={badges.length > 0 ? badges : undefined}
        >
          {item && getComponent(item, "!text-base")}
          <DateBox time={state.time} dict={dict} />
        </CustomCard>
      </div>
    </div>
  );
}

function DateBox({
  time,
  dict,
}: {
  time: {
    start: string | null;
    projected_start: string | null;
    end: string | null;
    projected_end: string | null;
    duration: number | null;
  };
  dict: I18nRecord;
}) {
  const start = fromString(
    (time.start ? time.start : time.projected_start) as string
  ).format("MM/DD/YYYY HH:mm");

  const end = fromString(
    (time.end ? time.end : time.projected_end) as string
  ).format("MM/DD/YYYY HH:mm");

  return (
    <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 w-full h-fit">
      <CustomCard title={null} subtitle={null}>
        <LoadableLabel
          label={
            time.start
              ? tr("wheres_my_load.start", dict)
              : tr("wheres_my_load.projected_start", dict)
          }
          value={<FormattedDate date={start} format="datetime" />}
          className="!text-base"
        />
        <LoadableLabel
          label={
            time.end
              ? tr("wheres_my_load.end", dict)
              : tr("wheres_my_load.projected_end", dict)
          }
          value={<FormattedDate date={end} format="datetime" />}
          className="!text-base"
        />
      </CustomCard>
    </div>
  );
}

function getComponent(item: LoadSearchResponse, className?: string) {
  // Here we add "State Id": Component
  const states_data: { [key: string]: () => React.ReactElement } = {};

  if (states_data[item.nombre_etapa_]) {
    return states_data[item.nombre_etapa_]();
  }

  return <GenericComponent item={item} badges={null} className={className} />;
}
