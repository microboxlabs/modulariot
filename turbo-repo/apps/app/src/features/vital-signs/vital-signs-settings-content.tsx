"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import SeverityLegend from "./severity-legend";
import VitalSignCard from "./vital-sign-card";
import { SYMPTOMS, recommendedReadySymptoms } from "./vital-signs-data";

// No org-specific persistence exists yet, so this defaults to the same
// baseline the onboarding "recommended" section uses (ready + commonly
// bundled vital signs) rather than starting everything off.
const DEFAULT_PROFILE_ID = "mining";

const PAGE_SIZE = 20;

export default function VitalSignsSettingsContent() {
  const searchParams = useSearchParams();
  const nameQuery = (searchParams.get("name") ?? "").trim().toLowerCase();
  const stateValues = (searchParams.get("state") ?? "")
    .split(",")
    .filter(Boolean);
  const statusValues = (searchParams.get("status") ?? "")
    .split(",")
    .filter(Boolean);

  const [enabled, setEnabled] = useState<Set<number>>(
    () =>
      new Set(
        recommendedReadySymptoms(DEFAULT_PROFILE_ID).map((symptom) => symptom.id)
      )
  );

  const toggleSymptom = (id: number, checked: boolean) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const visibleSymptoms = useMemo(() => {
    return SYMPTOMS.filter((symptom) => {
      if (nameQuery && !symptom.name.toLowerCase().includes(nameQuery)) {
        return false;
      }
      if (stateValues.length > 0 && !stateValues.includes(symptom.cat)) {
        return false;
      }
      if (statusValues.length === 1) {
        const isOn = enabled.has(symptom.id);
        if (statusValues[0] === "on" && !isOn) return false;
        if (statusValues[0] === "off" && isOn) return false;
      }
      return true;
    });
  }, [nameQuery, stateValues, statusValues, enabled]);

  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const stateKey = stateValues.join(",");
  const statusKey = statusValues.join(",");
  // Filters changed the result set, so start pagination over from the top.
  useEffect(() => {
    setPageSize(PAGE_SIZE);
  }, [nameQuery, stateKey, statusKey]);

  const paginatedSymptoms = visibleSymptoms.slice(0, pageSize);
  const hasMore = pageSize < visibleSymptoms.length;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollContainerRef.current;
    if (!sentinel || !root || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setPageSize((prev) => prev + PAGE_SIZE);
        }
      },
      { root, rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore]);

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-5 py-4">
      <div className="max-w-4xl mx-auto flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SeverityLegend />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {visibleSymptoms.length} available
          </p>
        </div>
        {visibleSymptoms.length === 0 ? (
          <p className="mt-8 text-center text-sm text-gray-400 dark:text-gray-500">
            No vital signs match your filters.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {paginatedSymptoms.map((symptom, index) => (
              <motion.div
                key={symptom.id}
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.35,
                  delay: (index % PAGE_SIZE) * 0.04,
                  ease: "easeOut",
                }}
              >
                <VitalSignCard
                  symptom={symptom}
                  checked={enabled.has(symptom.id)}
                  onToggleChange={(checked) => toggleSymptom(symptom.id, checked)}
                />
              </motion.div>
            ))}
            {hasMore && <div ref={sentinelRef} className="h-4" />}
          </div>
        )}
      </div>
    </div>
  );
}
