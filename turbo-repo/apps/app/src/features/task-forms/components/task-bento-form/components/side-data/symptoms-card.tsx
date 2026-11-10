"use client";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import CustomCard from "@/features/common/components/custom-card/custom-card";
import React from "react";
import SymptomIcon from "@/features/symptoms/components/symtom-icon";
import ConditionIcon from "@/features/symptoms/components/condition-icon";
import { useTreatmentsTrip } from "@/features/symptoms/hooks/use-treatments-trip";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  engineSymptomConditions,
  engineSymptomIcon,
  engineSymptomListHref,
  type EngineTripSymptom,
} from "@/features/symptoms/model/trip-symptoms";

// Symptom data structure
interface SymptomData {
  id: string;
  key: string;
  icon: string;
  label: string;
  count: number;
  conditions: string[];
  /** The symptom list filtered to these cases; engine symptoms with cases only. */
  href?: string | null;
}

// Symptom row component (same data as before, laid out as a compact row)
const SymptomCard = ({
  symptom,
  dict,
  loading = false,
}: {
  symptom: SymptomData;
  dict: I18nRecord;
  loading?: boolean;
}) => {
  const conditions = symptom.conditions.filter(Boolean);

  const row = (
    <div
      className={`flex items-center gap-2 py-1 px-1.5 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${
        symptom.href ? "hover:bg-gray-50 dark:hover:bg-gray-700" : ""
      }`}
    >
      <div className="text-gray-600 dark:text-gray-400 dark:bg-gray-300 rounded-md p-0.5 shrink-0">
        <SymptomIcon
          type={symptom.icon}
          size="h-5 w-5"
          dict={dict}
          fixed_label={symptom.label}
        />
      </div>

      <span className="flex-1 min-w-0 truncate font-light text-sm text-gray-600 dark:text-gray-300">
        {symptom.label}
      </span>

      {conditions.length > 0 && (
        <div className="flex -space-x-1.5 shrink-0">
          {conditions.map((condition) => (
            <ConditionIcon
              key={condition}
              condition={condition}
              size="h-4 w-4"
              dict={dict}
            />
          ))}
        </div>
      )}

      {loading ? (
        <div className="bg-gray-300 dark:bg-gray-700 animate-pulse rounded h-4 w-6 shrink-0" />
      ) : (
        <span
          className={`shrink-0 text-xs font-medium rounded px-1.5 py-0.5 min-w-6 text-center ${
            symptom.count > 0
              ? "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100"
              : "text-gray-300 dark:text-gray-600"
          }`}
        >
          {symptom.count.toString().padStart(2, "0")}
        </span>
      )}
    </div>
  );

  return symptom.href ? (
    <Link href={symptom.href} data-testid={`symptom-link-${symptom.key}`}>
      {row}
    </Link>
  ) : (
    row
  );
};

/** One row per engine symptom, with its cases on the trip. */
function engineRows(
  symptoms: EngineTripSymptom[],
  lang: string
): SymptomData[] {
  return symptoms.map((s) => ({
    id: s.definition_id,
    key: s.definition_id,
    icon: engineSymptomIcon(s),
    label: s.name,
    count: s.cases,
    conditions: engineSymptomConditions(s),
    href: engineSymptomListHref(lang, s),
  }));
}

export default function SymptomsCard({
  dict,
  task,
  reactive = true,
}: {
  readonly dict: I18nRecord;
  readonly task: TaskResponse;
  readonly reactive?: boolean;
}) {
  const { lang } = useParams<{ lang: string }>();
  const { tripSymptoms, isLoading, error } = useTreatmentsTrip(
    task.mintral_serviceCode
  );
  if (error) {
    return <div>Error: {error.message}</div>;
  }

  const allSymptoms = engineRows(tripSymptoms?.symptoms ?? [], lang);

  return (
    <CustomCard
      title={(dict.bento as I18nRecord).symptoms_present_in_the_trip as string}
      subtitle={null}
    >
      <div
        className={`grid gap-1.5 ${
          reactive
            ? "grid-cols-1 lg:grid-cols-2 lg:[&>*:last-child:nth-child(odd)]:col-span-2"
            : "grid-cols-2 md:grid-cols-3 max-md:[&>*:last-child:nth-child(odd)]:col-span-2 md:[&>*:last-child:nth-child(3n+1)]:col-span-3 md:[&>*:last-child:nth-child(3n+2)]:col-span-2"
        }`}
      >
        {allSymptoms.map((symptom) => (
          <SymptomCard
            key={symptom.key}
            symptom={symptom}
            dict={dict}
            loading={isLoading}
          />
        ))}
      </div>
    </CustomCard>
  );
}
