import { MetricCard } from "./MetricCard";
import { 
  Smartphone, 
  Users, 
  Activity, 
  Clock, 
  AlertTriangle, 
  TrendingUp,
  HardDrive,
  Brain
} from "lucide-react";

interface Metrics {
  activeDevices: number;
  totalDevices: number;
  eventsPerMin: number;
  ingestLatencyMs: number;
  alerts24h: number;
  criticalRatio: number;
  storageGB: number;
  advisorCalls: number;
  sparklines?: {
    [key: string]: Array<{ value: number }>;
  };
}

interface KpiRowProps {
  metrics: Metrics;
  plan: string;
}

export function KpiRow({ metrics, plan }: KpiRowProps) {
  const isFreePlan = plan === "free";
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
      <MetricCard
        title="Active Devices"
        value={metrics.activeDevices}
        icon={Smartphone}
        trend={metrics.activeDevices > 0 ? "up" : "stable"}
        sparklineData={metrics.sparklines?.activeDevices}
      />
      
      <MetricCard
        title="Total Devices"
        value={metrics.totalDevices}
        icon={Users}
        trend="stable"
        sparklineData={metrics.sparklines?.totalDevices}
      />
      
      <MetricCard
        title="Events/Min"
        value={metrics.eventsPerMin}
        icon={Activity}
        trend={metrics.eventsPerMin > 100 ? "up" : "stable"}
        sparklineData={metrics.sparklines?.eventsPerMin}
      />
      
      <MetricCard
        title="Latency"
        value={metrics.ingestLatencyMs}
        unit="ms"
        icon={Clock}
        trend={metrics.ingestLatencyMs < 100 ? "up" : "down"}
        sparklineData={metrics.sparklines?.ingestLatencyMs}
      />
      
      <MetricCard
        title="Symptoms (24h)"
        value={metrics.alerts24h}
        icon={AlertTriangle}
        trend={metrics.alerts24h === 0 ? "up" : "down"}
        sparklineData={metrics.sparklines?.alerts24h}
      />
      
      <MetricCard
        title="Critical Ratio"
        value={`${(metrics.criticalRatio * 100).toFixed(1)}%`}
        icon={TrendingUp}
        trend={metrics.criticalRatio < 0.1 ? "up" : "down"}
        sparklineData={metrics.sparklines?.criticalRatio}
      />
      
      {!isFreePlan && (
        <>
          <MetricCard
            title="Storage"
            value={metrics.storageGB.toFixed(1)}
            unit="GB"
            icon={HardDrive}
            trend="stable"
            sparklineData={metrics.sparklines?.storageGB}
            className="col-span-2 md:col-span-1"
          />
          
          <MetricCard
            title="AI Calls"
            value={metrics.advisorCalls}
            icon={Brain}
            trend={metrics.advisorCalls > 0 ? "up" : "stable"}
            sparklineData={metrics.sparklines?.advisorCalls}
            className="col-span-2 md:col-span-1"
          />
        </>
      )}
    </div>
  );
}