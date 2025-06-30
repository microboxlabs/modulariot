"use client";

import { Card, Tabs, Badge } from "flowbite-react";
import { ExternalLink, AlertTriangle, Zap } from "lucide-react";
import Link from "next/link";

interface Issue {
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  type: "security" | "performance";
  timestamp: string;
  description: string;
}

interface IssuesTableProps {
  issues: Issue[];
}

export function IssuesTable({ issues }: IssuesTableProps) {
  const securityIssues = issues.filter(issue => issue.type === "security").slice(0, 6);
  const performanceIssues = issues.filter(issue => issue.type === "performance").slice(0, 6);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "failure";
      case "high": return "warning";
      case "medium": return "yellow";
      case "low": return "info";
      default: return "gray";
    }
  };

  const renderIssueRow = (issue: Issue) => (
    <tr key={issue.id} className="border-b border-gray-200 dark:border-gray-700">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {issue.type === "security" ? (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          ) : (
            <Zap className="h-4 w-4 text-yellow-500" />
          )}
          <span className="font-medium text-sm">{issue.title}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge color={getSeverityColor(issue.severity)} size="sm">
          {issue.severity}
        </Badge>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {new Date(issue.timestamp).toLocaleDateString()}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
        {issue.description}
      </td>
    </tr>
  );

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Issues</h3>
        <Link 
          href="/logs" 
          className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
        >
          View all logs
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      <Tabs aria-label="Issues tabs" variant="underline">
        <Tabs.Item title={`Security (${securityIssues.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-4 py-3">Issue</th>
                  <th scope="col" className="px-4 py-3">Severity</th>
                  <th scope="col" className="px-4 py-3">Date</th>
                  <th scope="col" className="px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody>
                {securityIssues.length > 0 ? (
                  securityIssues.map(renderIssueRow)
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No security issues found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Tabs.Item>

        <Tabs.Item title={`Performance (${performanceIssues.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-4 py-3">Issue</th>
                  <th scope="col" className="px-4 py-3">Severity</th>
                  <th scope="col" className="px-4 py-3">Date</th>
                  <th scope="col" className="px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody>
                {performanceIssues.length > 0 ? (
                  performanceIssues.map(renderIssueRow)
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No performance issues found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Tabs.Item>
      </Tabs>
    </Card>
  );
}