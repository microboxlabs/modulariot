"use client";

import { Card, Dropdown, DropdownItem } from "flowbite-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface TimeSeriesData {
  timestamp: string;
  tps: number;
  alerts: number;
  storageGB: number;
}

interface TimeSeriesPanelProps {
  data: TimeSeriesData[];
  window: string;
  onWindowChange: (window: string) => void;
}

export function TimeSeriesPanel({ data, window, onWindowChange }: TimeSeriesPanelProps) {
  const [selectedChart, setSelectedChart] = useState<"tps" | "symptoms" | "storage">("tps");

  const getChartData = () => {
    switch (selectedChart) {
      case "tps":
        return { dataKey: "tps", color: "#3b82f6", label: "Transactions per Second" };
      case "symptoms":
        return { dataKey: "symptoms", color: "#ef4444", label: "Symptoms Count" };
      case "storage":
        return { dataKey: "storageGB", color: "#10b981", label: "Storage (GB)" };
    }
  };

  const chartConfig = getChartData();

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Time Series</h3>
          
          {/* Chart Type Selector */}
          <div className="flex gap-2">
            {["tps", "symptoms", "storage"].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedChart(type as any)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${ 
                  selectedChart === type 
                    ? "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {type === "tps" ? "TPS" : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Time Window Dropdown */}
        <Dropdown
          label={window}
          dismissOnClick={true}
          renderTrigger={() => (
            <button className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700">
              {window}
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
        >
          <DropdownItem onClick={() => onWindowChange("15m")}>15 minutes</DropdownItem>
          <DropdownItem onClick={() => onWindowChange("60m")}>1 hour</DropdownItem>
          <DropdownItem onClick={() => onWindowChange("24h")}>24 hours</DropdownItem>
        </Dropdown>
      </div>

      <div className="h-180" style={{ height: "180px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={(value) => new Date(value).toLocaleTimeString()}
              className="text-xs"
            />
            <YAxis className="text-xs" />
            <Tooltip 
              labelFormatter={(value) => new Date(value).toLocaleString()}
              formatter={(value: any) => [value, chartConfig.label]}
            />
            <Line 
              type="monotone" 
              dataKey={chartConfig.dataKey}
              stroke={chartConfig.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}