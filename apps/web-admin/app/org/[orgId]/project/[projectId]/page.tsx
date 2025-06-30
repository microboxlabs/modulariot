"use client";

import { useState } from "react";
import { Badge } from "flowbite-react";
import { Circle } from "lucide-react";
import useSWR from "swr";

import { KpiRow } from "@/app/components/KpiRow";
import { TimeSeriesPanel } from "@/app/components/TimeSeriesPanel";
import { IssuesTable } from "@/app/components/IssuesTable";
import { SlowQueriesTable } from "@/app/components/SlowQueriesTable";
import { LibrariesAndExamples } from "@/app/components/LibrariesAndExamples";
import { useParams } from "next/navigation";

interface ProjectPageProps {
  params: {
    orgId: string;
    projectId: string;
  };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ProjectOverviewPage({ params }: ProjectPageProps) {
  const { orgId, projectId } = useParams();
  const [timeWindow, setTimeWindow] = useState("60m");

  const { data, error, isLoading } = useSWR(
    `/api/projects/${projectId}/metrics?window=${timeWindow}`,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: false,
    }
  );

  // Generate realistic time series data for placeholder
  const generateTimeSeriesData = (window: string) => {
    const now = new Date();
    const windowMs = {
      "15m": 15 * 60 * 1000,
      "60m": 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
    }[window] || 60 * 60 * 1000;

    const dataPoints = {
      "15m": 30,
      "60m": 60,
      "24h": 144,
    }[window] || 60;

    const interval = windowMs / dataPoints;

    return Array.from({ length: dataPoints }, (_, i) => {
      const timestamp = new Date(now.getTime() - (dataPoints - i - 1) * interval);
      
      // Generate realistic patterns with some variability
      const hourOfDay = timestamp.getHours();
      const isBusinessHours = hourOfDay >= 9 && hourOfDay <= 17;
      const businessMultiplier = isBusinessHours ? 1.5 : 0.7;
      
      // Add some noise and trends
      const baseVariability = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
      const trendFactor = 1 + Math.sin(i * 0.1) * 0.2; // Gentle wave pattern
      
      return {
        timestamp: timestamp.toISOString(),
        tps: Math.floor((500 + Math.random() * 300) * businessMultiplier * baseVariability * trendFactor),
        symptoms: Math.floor((2 + Math.random() * 6) * (isBusinessHours ? 1.3 : 0.6) * baseVariability),
        storageGB: 10 + Math.random() * 40 + (i * 0.05), // Gradual growth over time
      };
    });
  };

  // Generate sparkline data for metrics
  const generateSparklineData = () => {
    const points = 20;
    return {
      activeDevices: Array.from({ length: points }, (_, i) => ({ 
        value: 50 + Math.floor(Math.random() * 100) + Math.sin(i * 0.3) * 20
      })),
      totalDevices: Array.from({ length: points }, (_, i) => ({ 
        value: 200 + Math.floor(Math.random() * 50) + (i * 2) // Gradual growth
      })),
      eventsPerMin: Array.from({ length: points }, (_, i) => ({ 
        value: 100 + Math.floor(Math.random() * 500) + Math.cos(i * 0.4) * 100
      })),
      ingestLatencyMs: Array.from({ length: points }, (_, i) => ({ 
        value: 20 + Math.floor(Math.random() * 80) + Math.sin(i * 0.2) * 15
      })),
      alerts24h: Array.from({ length: points }, (_, i) => ({ 
        value: Math.floor(Math.random() * 8) + Math.sin(i * 0.5) * 2
      })),
      criticalRatio: Array.from({ length: points }, (_, i) => ({ 
        value: Math.random() * 0.15 + Math.sin(i * 0.3) * 0.05
      })),
      storageGB: Array.from({ length: points }, (_, i) => ({ 
        value: 30 + Math.random() * 20 + (i * 0.5)
      })),
      advisorCalls: Array.from({ length: points }, (_, i) => ({ 
        value: 10 + Math.floor(Math.random() * 40) + Math.cos(i * 0.6) * 15
      })),
    };
  };

  // Placeholder data when API returns 501 or fails
  const placeholderData = {
    metrics: {
      activeDevices: Math.floor(Math.random() * 100) + 50,
      totalDevices: Math.floor(Math.random() * 50) + 200,
      eventsPerMin: Math.floor(Math.random() * 500) + 100,
      ingestLatencyMs: Math.floor(Math.random() * 100) + 20,
      alerts24h: Math.floor(Math.random() * 10),
      criticalRatio: Math.random() * 0.2,
      storageGB: Math.random() * 20 + 30,
      advisorCalls: Math.floor(Math.random() * 50) + 10,
      sparklines: generateSparklineData(),
    },
    timeSeries: generateTimeSeriesData(timeWindow),
    issues: [
      {
        id: "sec-001",
        title: "Weak Authentication Detected",
        severity: "high" as const,
        type: "security" as const,
        timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        description: "Device using default credentials detected"
      },
      {
        id: "perf-001", 
        title: "High Memory Usage",
        severity: "medium" as const,
        type: "performance" as const,
        timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        description: "Memory usage above 80% threshold"
      },
      {
        id: "sec-002",
        title: "Outdated TLS Version",
        severity: "medium" as const,
        type: "security" as const,
        timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        description: "Device using TLS 1.1, upgrade to 1.3 recommended"
      }
    ],
    slowQueries: [
      {
        id: "query-001",
        query: "SELECT * FROM device_data WHERE timestamp > NOW() - INTERVAL 1 DAY ORDER BY timestamp DESC",
        duration: 2500,
        timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        database: "timeseries_db",
        impact: "medium" as const
      },
      {
        id: "query-002",
        query: "SELECT device_id, COUNT(*) FROM events GROUP BY device_id HAVING COUNT(*) > 1000",
        duration: 1800,
        timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        database: "analytics_db",
        impact: "low" as const
      }
    ],
    project: {
      name: "Project Overview",
      plan: "professional",
      status: "live"
    }
  };

  const displayData = error || (data && data.message) ? placeholderData : data || placeholderData;
  const { metrics, timeSeries, issues, slowQueries, project } = displayData;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "live": return "success";
      case "paused": return "warning";
      case "error": return "failure";
      default: return "gray";
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case "free": return "gray";
      case "professional": return "info";
      case "enterprise": return "purple";
      default: return "gray";
    }
  };

  if (isLoading) {
    return (
      <div className="container px-6 mx-auto py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container px-6 mx-auto py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <div className="flex items-center gap-2">
            <Badge color={getPlanColor(project.plan)} size="sm">
              {project.plan}
            </Badge>
            <div className="flex items-center gap-1">
              <Circle 
                className={`h-2 w-2 fill-current ${
                  project.status === "live" 
                    ? "text-green-500" 
                    : project.status === "paused" 
                    ? "text-yellow-500" 
                    : "text-red-500"
                }`} 
              />
              <Badge color={getStatusColor(project.status)} size="sm">
                {project.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <KpiRow metrics={metrics} plan={project.plan} />

      {/* Time Series Charts */}
      <TimeSeriesPanel 
        data={timeSeries} 
        window={timeWindow}
        onWindowChange={setTimeWindow}
      />

      {/* Issues Table */}
      <IssuesTable issues={issues} />

      {/* Slow Queries Table */}
      <SlowQueriesTable queries={slowQueries} />

      {/* Client Libraries and Examples */}
      <LibrariesAndExamples />
    </div>
  );
}