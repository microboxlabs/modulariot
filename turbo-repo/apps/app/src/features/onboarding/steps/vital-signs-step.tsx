"use client";

import { useState } from "react";
import SeverityLegend from "@/features/vital-signs/severity-legend";
import VitalSignCard from "@/features/vital-signs/vital-sign-card";
import {
  CATS,
  PROFILES,
  SYMPTOMS,
  recommendedReadySymptoms,
} from "@/features/vital-signs/vital-signs-data";

const CATEGORIES_IN_ORDER = Object.values(CATS).sort(
  (a, b) => a.order - b.order
);

export default function VitalSignsStep({
  profileId,
}: Readonly<{ profileId: string }>) {
  const profile = PROFILES.find((p) => p.id === profileId) ?? PROFILES[0];
  const recommended = recommendedReadySymptoms(profile.id);
  const recommendedIds = new Set(recommended.map((symptom) => symptom.id));

  const [enabled, setEnabled] = useState<Set<number>>(
    () => new Set(recommendedIds)
  );

  const toggleSymptom = (id: number, checked: boolean) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col items-start w-full max-w-3xl mx-auto gap-4">
      <div className="flex flex-col text-left">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-white">
          Your vital signs
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Recommended for {profile.label}. Green items turn on now — the
          rest unlock when their data source is connected.
        </p>
      </div>
      <SeverityLegend />
      <div className="flex flex-col gap-4 w-full">
        {recommended.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Recommended
            </h3>
            {recommended.map((symptom) => (
              <VitalSignCard
                key={symptom.id}
                symptom={symptom}
                checked={enabled.has(symptom.id)}
                onToggleChange={(checked) => toggleSymptom(symptom.id, checked)}
              />
            ))}
          </div>
        )}
        {CATEGORIES_IN_ORDER.map((cat) => {
          const symptomsInCat = SYMPTOMS.filter(
            (symptom) => symptom.cat === cat.id && !recommendedIds.has(symptom.id)
          );
          if (symptomsInCat.length === 0) return null;

          return (
            <div key={cat.id} className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {cat.label}
              </h3>
              {symptomsInCat.map((symptom) => (
                <VitalSignCard
                  key={symptom.id}
                  symptom={symptom}
                  checked={enabled.has(symptom.id)}
                  onToggleChange={(checked) => toggleSymptom(symptom.id, checked)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
