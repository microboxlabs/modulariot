"use client";

import { AlertTriangle } from "lucide-react";

interface DangerCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export default function DangerCard({ title, description, children }: DangerCardProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-6 w-6 text-red-500" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-400">
            {title}
          </h3>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            {description}
          </p>
          <div className="mt-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}