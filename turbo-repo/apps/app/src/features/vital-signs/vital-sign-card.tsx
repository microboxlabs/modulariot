"use client";

import { useState } from "react";
import { Badge, ToggleSwitch } from "flowbite-react";
import ExpandableSection from "@/features/fleet-management/components/vehicle-detail/expandable-section";
import SeverityDots from "./severity-dots";
import VitalSignParamField from "./vital-sign-param-field";
import VitalSignConditionBuilder, {
  ConditionRowValue,
} from "./vital-sign-condition-builder";
import { CATS, VitalSign } from "./vital-signs-data";

function badgeColorForCat(catId: VitalSign["cat"]): string {
  switch (catId) {
    case "gps_metrics":
      return "success";
    case "trip_planning":
      return "warning";
    case "event":
      return "purple";
    case "sensor":
      return "gray";
  }
}

export default function VitalSignCard({
  symptom,
  checked,
  onToggleChange,
}: {
  symptom: VitalSign;
  checked: boolean;
  onToggleChange: (checked: boolean) => void;
}) {
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

  const hasForm = symptom.params.length > 0 || Boolean(symptom.condition);

  return (
    <ExpandableSection
      title={symptom.name}
      description={symptom.desc}
      headerAccessory={
        <ToggleSwitch
          checked={checked}
          onChange={onToggleChange}
          disabled={!symptom.ready}
          sizing="sm"
        />
      }
      badge={
        <div className="flex items-center gap-3">
          <Badge color={badgeColorForCat(symptom.cat)}>{cat.label}</Badge>
          <SeverityDots ceiling={symptom.ceiling} />
        </div>
      }
    >
      {!hasForm ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          No additional configuration for this vital sign.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {symptom.condition && (
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
