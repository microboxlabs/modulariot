"use client";

import { CircularProgress } from "@/features/common/components/circular-progress";

interface CollaboratorPerformanceBadgeProps {
  readonly score: number;
}

export default function CollaboratorPerformanceBadge({
  score,
}: CollaboratorPerformanceBadgeProps) {
  return <CircularProgress value={score} size={32} />;
}
