"use client";

import { useState } from "react";
import { ToggleSwitch } from "flowbite-react";
import { CustomBadge } from "@/features/common/components/custom-badge";
import ExpandableSection from "@/features/fleet-management/components/vehicle-detail/expandable-section";
import SeverityDots from "./severity-dots";
import VitalSignParamField from "./vital-sign-param-field";
import VitalSignConditionBuilder, {
  ConditionRowValue,
} from "./vital-sign-condition-builder";
import { CATS, VitalSign } from "./vital-signs-data";

function badgeClassNameForCat(catId: VitalSign["cat"]): string {
  switch (catId) {
    case "gps_metrics":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
    case "trip_planning":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
    case "event":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300";
    case "sensor":
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  }
}

export default function VitalSignCard({
  symptom,
  checked,
  onToggleChange,
  minimal = false,
}: Readonly<{
  symptom: VitalSign;
  checked: boolean;
  onToggleChange: (checked: boolean) => void;
  minimal?: boolean;
}>) {
  const cat = CATS[symptom.cat];

  const [paramValues, setParamValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      symptom.params.map((param) => [param.key, param.defaultValue])
    )
  );

  const [conditionRows, setConditionRows] = useState<
    Record<number, ConditionRowValue>
  >(() =>
    Object.fromEntries(
      (symptom.condition?.rows ?? []).map((row) => [
        row.severityCode,
        { operator: row.operator, value: row.value },
      ])
    )
  );

  const showCondition = !minimal && Boolean(symptom.condition);
  const hasForm = symptom.params.length > 0 || showCondition;

  return (
    <ExpandableSection
      title={symptom.name}
      description={symptom.desc}
      headerAccessory={
        <div className="flex items-center gap-3">
          <ToggleSwitch
            checked={checked}
            onChange={onToggleChange}
            disabled={!symptom.ready}
            sizing="sm"
          />
          {/* Its tooltip trigger is a real <button>, so this can't live
              inside the header <button> above (badge) without nesting
              buttons — kept here instead, alongside the toggle. */}
          {!minimal && <SeverityDots ceiling={symptom.ceiling} />}
        </div>
      }
      badge={
        <CustomBadge text={cat.label} className={badgeClassNameForCat(symptom.cat)} />
      }
    >
      {!hasForm ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          No additional configuration for this vital sign.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {showCondition && symptom.condition && (
            <VitalSignConditionBuilder
              condition={symptom.condition}
              rows={symptom.condition.rows.map(
                (row) => conditionRows[row.severityCode]
              )}
              onChangeRow={(severityCode, row) =>
                setConditionRows((prev) => ({ ...prev, [severityCode]: row }))
              }
            />
          )}
          {symptom.params.length > 0 && (
            <div className="flex flex-col gap-2">
              {symptom.params.map((param) => (
                <VitalSignParamField
                  key={param.key}
                  param={param}
                  value={paramValues[param.key]}
                  onChange={(value) =>
                    setParamValues((prev) => ({ ...prev, [param.key]: value }))
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </ExpandableSection>
  );
}
