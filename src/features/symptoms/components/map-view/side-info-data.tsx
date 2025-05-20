"use client";

import ConditionIcon from "../condition-icon";
import ExpandableButton from "../expandable-button";
import { Conditions } from "../table-item.type";
import { FaClock, FaTruck } from "react-icons/fa";
import { Spinner } from "flowbite-react";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { FaUser } from "react-icons/fa6";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import TimelineComponent from "./timeline";
import { ConditionsAgg } from "../../types/timeline";
export default function SideInfoData({
  dict,
  lang,
  treatmentData,
  loading,
  error,
  setSelectedTreatment,
  setSelectedTreatmentIndex,
  withBorder = false,
  withBottomPadding = true,
}: {
  dict: I18nRecord;
  lang: string;
  treatmentData: TreatmentsGeneralResponseItem | null;
  loading: boolean;
  error: Error | null;
  setSelectedTreatment: (treatment: TreatmentsGeneralResponseItem) => void;
  setSelectedTreatmentIndex: (
    treatmentIndex: ConditionsAgg,
  ) => void;
  withBorder?: boolean;
  withBottomPadding?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !treatmentData) {
    return (
      <div className="text-red-500 text-center p-4">
        {error?.message || "No treatment data available"}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-2 w-full ${
        withBottomPadding ? "pb-20" : ""
      } overflow-y-auto`}
    >
      <ExpandableButton
        withBorder={withBorder}
        initial_state={true}
        icon={<FaTruck />}
        title={(dict.symptoms as I18nRecord).condition as string}
        description={
          (dict.symptoms as I18nRecord).relevant_information as string
        }
      >
        <div className="flex flex-col gap-2">
          <div
            className={`flex flex-row items-center gap-2 p-1 rounded-md ${
              Conditions[
                treatmentData?.symptom_info?.icu_condition.toLowerCase() ??
                  "stable"
              ].bgColor
            }`}
          >
            <ConditionIcon
              condition={
                treatmentData?.symptom_info?.icu_condition.toLowerCase() ??
                "stable"
              }
              size="h-7 w-7"
              dict={dict}
            />
            <p
              className={`text-sm font-medium ${
                Conditions[
                  treatmentData?.symptom_info?.icu_condition.toLowerCase() ??
                    "stable"
                ].textColor
              }`}
            >
              {new Date().toLocaleString().split(",")[1]}
              <span className="text-gray-400 text-xs">
                {" "}
                {treatmentData?.trip_info?.trip_id}
              </span>
            </p>
          </div>
          <p className="text-sm">
            {(dict.symptoms as I18nRecord).observed_symptom as string}:{" "}
            <span className="text-gray-500 dark:text-gray-400">
              {treatmentData?.symptom_info?.name}
            </span>
          </p>
          {/* <p className="text-sm">
            {dict.symptoms.event}:{" "}
            <span className="text-gray-500 dark:text-gray-400">
              {treatmentData.symptom_info.type}
            </span>
          </p>
          <p className="text-sm">
            {dict.symptoms.trip}:{" "}
            <span className="text-gray-500 dark:text-gray-400">
              {treatmentData.trip_info.trip_id}
            </span>
          </p>
          <p className="text-sm">
            {dict.symptoms.driver}:{" "}
            <span className="text-gray-500 dark:text-gray-400">
              {treatmentData.trip_info.driver}
            </span>
          </p>
          <p className="text-sm">
            {dict.symptoms.client}:{" "}
            <span className="text-gray-500 dark:text-gray-400">
              {treatmentData.trip_info.carrier}
            </span>
          </p> */}
        </div>
      </ExpandableButton>
      <ExpandableButton
        withBorder={withBorder}
        initial_state={true}
        icon={<FaUser />}
        title={(dict.symptoms as I18nRecord).service as string}
        description={(dict.symptoms as I18nRecord).driver_description as string}
      >
        <div className="flex flex-col gap-2">
          <div
            className={`flex flex-row items-center gap-2 p-1 rounded-md ${
              Conditions[
                treatmentData?.symptom_info?.icu_condition.toLowerCase() ??
                  "stable"
              ].bgColor
            }`}
          >
            <ConditionIcon
              condition={
                treatmentData?.symptom_info?.icu_condition.toLowerCase() ??
                "stable"
              }
              size="h-7 w-7"
              dict={dict}
            />
            <p
              className={`text-sm font-medium ${
                Conditions[
                  treatmentData?.symptom_info?.icu_condition.toLowerCase() ??
                    "stable"
                ].textColor
              }`}
            >
              {new Date().toLocaleString().split(",")[1]}
              <span className="text-gray-400 text-xs">
                {" "}
                {treatmentData?.trip_info?.trip_id}
              </span>
            </p>
          </div>
          <p className="text-sm">
            ID:{" "}
            <span className="text-gray-500 dark:text-gray-400">
              {treatmentData?.trip_info?.trip_id}
            </span>
          </p>
          <p className="text-sm">
            {(dict.symptoms as I18nRecord).active as string}:{" "}
            <span className="text-gray-500 dark:text-gray-400">
              {treatmentData?.trip_info?.asset_id}
            </span>
          </p>
          <p className="text-sm">
            {(dict.symptoms as I18nRecord).route as string}:{" "}
            <span className="text-gray-500 dark:text-gray-400">
              {treatmentData?.trip_info?.origin} -{" "}
              {treatmentData?.trip_info?.destination}
            </span>
          </p>
          <p className="text-sm">
            {(dict.symptoms as I18nRecord).transporter as string}:{" "}
            <span className="text-gray-500 dark:text-gray-400">
              {treatmentData?.trip_info?.carrier}
            </span>
          </p>
          <p className="text-sm">
            {(dict.symptoms as I18nRecord).driver as string}:{" "}
            <span className="text-gray-500 dark:text-gray-400">
              {treatmentData?.trip_info?.driver}
            </span>
          </p>
        </div>
      </ExpandableButton>
      {/* Timeline section - show only if we have timeline data */}
      {treatmentData?.timeline?.length > 0 && (
        <ExpandableButton
          withBorder={withBorder}
          icon={<FaClock />}
          title={(dict.symptoms as I18nRecord).timeline as string}
          description={
            (dict.symptoms as I18nRecord).timeline_description as string
          }
        >
          <TimelineComponent
            dict={dict}
            treatmentData={treatmentData}
            setSelectedTreatment={setSelectedTreatment}
            setSelectedTreatmentIndex={setSelectedTreatmentIndex}
            order={"asc"}
          />
        </ExpandableButton>
      )}
    </div>
  );
}
