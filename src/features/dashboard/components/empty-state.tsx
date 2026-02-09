"use client";

import { Button } from "flowbite-react";
import { HiPlus } from "react-icons/hi2";
import { HiChartBar } from "react-icons/hi";

interface EmptyStateProps {
  onAdd: () => void;
}

export function EmptyState({ onAdd }: Readonly<EmptyStateProps>) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16">
      {/* Icon */}
      <div className="mb-6 rounded-full bg-gray-100 p-6 dark:bg-gray-800">
        <HiChartBar className="h-12 w-12 text-gray-400 dark:text-gray-500" />
      </div>

      {/* Title */}
      <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
        No widgets yet
      </h2>

      {/* Description */}
      <p className="mb-6 max-w-sm text-center text-gray-500 dark:text-gray-400">
        Start building your dashboard by adding widgets. Choose from charts,
        metrics, containers, and more to visualize your data.
      </p>

      {/* CTA Button */}
      <Button color="blue" onClick={onAdd}>
        <HiPlus className="mr-2 h-4 w-4" />
        Add Widget
      </Button>
    </div>
  );
}
