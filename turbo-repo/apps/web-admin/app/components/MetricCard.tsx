"use client";

import { Card } from "flowbite-react";
import { LucideIcon } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "stable";
  sparklineData?: Array<{ value: number }>;
  className?: string;
}

export function MetricCard({ 
  title, 
  value, 
  unit = "", 
  icon: Icon, 
  trend, 
  sparklineData,
  className = ""
}: MetricCardProps) {
  const getTrendColor = () => {
    if (!trend) return "text-gray-500";
    switch (trend) {
      case "up": return "text-green-500";
      case "down": return "text-red-500";
      case "stable": return "text-gray-500";
    }
  };

  return (
    <Card className={`min-w-32 h-24 bg-gray-50 dark:bg-gray-800 ${className}`}>
      <div className="flex items-center justify-between h-full p-3">
        <div className="flex flex-col">
          <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400 mb-1" />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {title}
          </span>
        </div>
        
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1">
            <span className={`text-lg font-semibold ${getTrendColor()}`}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
            {unit && (
              <span className="text-xs text-gray-400">{unit}</span>
            )}
          </div>
          
          {sparklineData && sparklineData.length > 0 && (
            <div className="w-16 h-6 mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData}>
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke={trend === "up" ? "#10b981" : trend === "down" ? "#ef4444" : "#6b7280"}
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}