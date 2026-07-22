"use client";

import { Badge, Spinner } from "flowbite-react";
import { JOB_STATE_BADGE, type JobState } from "../integration-job.types";

interface JobStateBadgeProps {
  readonly state: JobState;
  readonly label: string;
}

export default function JobStateBadge({ state, label }: JobStateBadgeProps) {
  return (
    <Badge color={JOB_STATE_BADGE[state]} className="w-fit whitespace-nowrap">
      <span className="inline-flex items-center gap-1.5">
        {state === "RUNNING" && <Spinner size="xs" aria-hidden />}
        {label}
      </span>
    </Badge>
  );
}
