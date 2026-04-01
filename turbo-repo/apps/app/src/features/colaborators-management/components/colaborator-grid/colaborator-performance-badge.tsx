"use client";

import { CircularProgress } from "@/features/common/components/circular-progress";

interface ColaboratorPerformanceBadgeProps {
  readonly score: number;
}

export default function ColaboratorPerformanceBadge({
  score,
}: ColaboratorPerformanceBadgeProps) {
  return <CircularProgress value={score} size={32} />;
}
