import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const metricsQuerySchema = z.object({
  window: z.enum(["15m", "60m", "24h"]).default("60m"),
});

// Mock data generator
function generateMockMetrics(window: string) {
  const now = new Date();
  const windowMs = {
    "15m": 15 * 60 * 1000,
    "60m": 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
  }[window];

  const dataPoints = {
    "15m": 30,
    "60m": 60,
    "24h": 144,
  }[window];

  const interval = windowMs! / dataPoints!;

  // Generate time series data
  const timeSeriesData = Array.from({ length: dataPoints! }, (_, i) => {
    const timestamp = new Date(now.getTime() - (dataPoints! - i - 1) * interval);
    return {
      timestamp: timestamp.toISOString(),
      tps: Math.floor(Math.random() * 1000) + 500,
      alerts: Math.floor(Math.random() * 5),
      storageGB: 10 + Math.random() * 50,
    };
  });

  // Generate sparkline data for metrics
  const sparklinePoints = 20;
  const sparklineData = {
    activeDevices: Array.from({ length: sparklinePoints }, () => ({ 
      value: Math.floor(Math.random() * 100) + 50 
    })),
    totalDevices: Array.from({ length: sparklinePoints }, () => ({ 
      value: Math.floor(Math.random() * 50) + 200 
    })),
    eventsPerMin: Array.from({ length: sparklinePoints }, () => ({ 
      value: Math.floor(Math.random() * 500) + 100 
    })),
    ingestLatencyMs: Array.from({ length: sparklinePoints }, () => ({ 
      value: Math.floor(Math.random() * 100) + 20 
    })),
    alerts24h: Array.from({ length: sparklinePoints }, () => ({ 
      value: Math.floor(Math.random() * 10) 
    })),
    criticalRatio: Array.from({ length: sparklinePoints }, () => ({ 
      value: Math.random() * 0.2 
    })),
    storageGB: Array.from({ length: sparklinePoints }, () => ({ 
      value: Math.random() * 20 + 30 
    })),
    advisorCalls: Array.from({ length: sparklinePoints }, () => ({ 
      value: Math.floor(Math.random() * 50) + 10 
    })),
  };

  // Generate mock issues
  const issues = [
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
    },
    {
      id: "perf-002",
      title: "Slow Query Performance",
      severity: "low" as const,
      type: "performance" as const,
      timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      description: "Database query taking longer than expected"
    }
  ];

  // Generate mock slow queries
  const slowQueries = [
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
    },
    {
      id: "query-003",
      query: "UPDATE device_status SET last_seen = NOW() WHERE device_id IN (SELECT ...)",
      duration: 5200,
      timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      database: "main_db",
      impact: "high" as const
    }
  ];

  return {
    metrics: {
      activeDevices: Math.floor(Math.random() * 100) + 50,
      totalDevices: Math.floor(Math.random() * 50) + 200,
      eventsPerMin: Math.floor(Math.random() * 500) + 100,
      ingestLatencyMs: Math.floor(Math.random() * 100) + 20,
      alerts24h: Math.floor(Math.random() * 10),
      criticalRatio: Math.random() * 0.2,
      storageGB: Math.random() * 20 + 30,
      advisorCalls: Math.floor(Math.random() * 50) + 10,
      sparklines: sparklineData,
    },
    timeSeries: timeSeriesData,
    issues,
    slowQueries,
    project: {
      name: "IoT Production Fleet",
      plan: "professional",
      status: "live"
    }
  };
}

export async function GET(
  request: NextRequest,
) {
  try {
    const url = new URL(request.url);
    const { window } = metricsQuerySchema.parse({
      window: url.searchParams.get("window"),
    });

    // TODO: Replace with real database queries
    // For now, return mock data
    const mockData = generateMockMetrics(window);

    return NextResponse.json(mockData);
  } catch (error) {
    console.error("Error fetching project metrics:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid parameters", errors: error.errors },
        { status: 400 }
      );
    }

    // Return 501 to trigger placeholder data in frontend
    return NextResponse.json(
      { message: "Metrics service not implemented yet" },
      { status: 501 }
    );
  } 
}