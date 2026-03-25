"use client";

import { Card, Button, Table, Badge, Alert, TableHead, TableHeadCell, TableBody, TableRow, TableCell } from "flowbite-react";
import { Crown, Calendar, User, Activity } from "lucide-react";

interface AuditLogEntry {
  id: string;
  event: string;
  actor: string;
  target?: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, unknown>;
}

export default function AuditLogsPage() {
  
  // TODO: Load organization plan from API
  const organizationPlan = "free"; // stub - will be "free", "pro", "team", "enterprise"
  const isAuditLogsEnabled = ["team", "enterprise"].includes(organizationPlan);

  // TODO: Load audit logs from API
  const auditLogs: AuditLogEntry[] = isAuditLogsEnabled ? [
    {
      id: "1",
      event: "user.login",
      actor: "john.doe@example.com",
      timestamp: "2024-01-15T14:30:00Z",
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    },
    {
      id: "2",
      event: "organization.member.invited",
      actor: "admin@example.com",
      target: "jane.smith@example.com",
      timestamp: "2024-01-15T12:15:00Z",
      ipAddress: "192.168.1.2",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      metadata: { role: "member" },
    },
    {
      id: "3",
      event: "organization.settings.updated",
      actor: "admin@example.com",
      timestamp: "2024-01-14T16:45:00Z",
      ipAddress: "192.168.1.2",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      metadata: { changes: ["name", "description"] },
    },
  ] : [];

  const getEventBadgeColor = (event: string) => {
    if (event.includes("login") || event.includes("logout")) return "blue";
    if (event.includes("invited") || event.includes("added")) return "green";
    if (event.includes("removed") || event.includes("deleted")) return "red";
    if (event.includes("updated") || event.includes("modified")) return "yellow";
    return "gray";
  };

  const formatEventName = (event: string) => {
    return event
      .split(".")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (!isAuditLogsEnabled) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Audit Logs
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Track and monitor all activities within your organization.
          </p>
        </div>

        <Card>
          <div className="text-center py-12">
            <Crown className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Audit Logs - Team Plan Required
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Audit logs provide detailed tracking of all user activities and system events. 
              Upgrade to a Team or Enterprise plan to access this feature.
            </p>
            
            <Alert color="info" className="mb-6 text-left max-w-md mx-auto">
              <div className="flex items-start">
                <Activity className="h-5 w-5 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h4 className="font-medium mb-1">{"What you'll get:"}</h4>
                  <ul className="text-sm space-y-1">
                    <li>• Complete activity tracking</li>
                    <li>• User login/logout events</li>
                    <li>• Organization changes</li>
                    <li>• Member management events</li>
                    <li>• 90-day retention period</li>
                  </ul>
                </div>
              </div>
            </Alert>

            <div className="space-x-3">
              <Button>
                Upgrade to Team Plan
              </Button>
              <Button color="gray">
                Learn More
              </Button>
            </div>
            
            {/* TODO: Add pricing information component */}
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
              Team plan starts at $29/month • Enterprise plans available
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Audit Logs
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Track and monitor all activities within your organization.
          </p>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <Calendar className="inline h-4 w-4 mr-1" />
          90-day retention
        </div>
      </div>

      <Card>
        {auditLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableHeadCell>Event</TableHeadCell>
                <TableHeadCell>Actor</TableHeadCell>
                <TableHeadCell>Target</TableHeadCell>
                <TableHeadCell>Timestamp</TableHeadCell>
                <TableHeadCell>IP Address</TableHeadCell>
                <TableHeadCell>Details</TableHeadCell>
              </TableHead>
              <TableBody className="divide-y">
                {auditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge color={getEventBadgeColor(log.event)}>
                        {formatEventName(log.event)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-2 text-gray-400" />
                        {log.actor}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.target ? (
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-2 text-gray-400" />
                          {log.target}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{new Date(log.timestamp).toLocaleDateString()}</div>
                        <div className="text-gray-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                        {log.ipAddress}
                      </code>
                    </TableCell>
                    <TableCell>
                      {log.metadata ? (
                        <details className="text-sm">
                          <summary className="cursor-pointer text-blue-600 hover:text-blue-800 dark:text-blue-400">
                            View Details
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <Activity className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              No audit logs yet
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Audit logs will appear here as activities occur in your organization.
            </p>
          </div>
        )}
      </Card>

      {/* TODO: Add filtering and search functionality */}
      <div className="text-sm text-gray-500 dark:text-gray-400">
        <p>
          Audit logs are retained for 90 days. For longer retention periods, 
          consider upgrading to Enterprise plan.
        </p>
      </div>
    </div>
  );
}