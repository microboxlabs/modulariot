import React from "react";

interface TaskCounterProps {
  count: number;
}

export default function TaskCounter({ count }: TaskCounterProps) {
  return (
    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
      {`${count} activos`}
    </div>
  );
}
