"use client";

import { Card, Badge } from "flowbite-react";
import { ChevronDown, ChevronRight, ExternalLink, Clock } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

interface SlowQuery {
  id: string;
  query: string;
  duration: number;
  timestamp: string;
  database: string;
  impact: "low" | "medium" | "high";
}

interface SlowQueriesTableProps {
  queries: SlowQuery[];
}

export function SlowQueriesTable({ queries }: SlowQueriesTableProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const displayQueries = queries.slice(0, 6);

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high": return "failure";
      case "medium": return "warning";
      case "low": return "success";
      default: return "gray";
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const truncateQuery = (query: string, maxLength = 50) => {
    if (query.length <= maxLength) return query;
    return query.substring(0, maxLength) + "...";
  };

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-lg font-semibold hover:text-primary-600 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
          <Clock className="h-5 w-5" />
          Slow Queries ({queries.length})
        </button>
        
        {isExpanded && (
          <Link 
            href="/logs?filter=slow-queries" 
            className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            View all queries
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      {isExpanded && (
        <div className="mt-4">
          {displayQueries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                  <tr>
                    <th scope="col" className="px-4 py-3">Query</th>
                    <th scope="col" className="px-4 py-3">Duration</th>
                    <th scope="col" className="px-4 py-3">Database</th>
                    <th scope="col" className="px-4 py-3">Impact</th>
                    <th scope="col" className="px-4 py-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {displayQueries.map((query) => (
                    <tr key={query.id} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-3">
                        <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          {truncateQuery(query.query)}
                        </code>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">
                        {formatDuration(query.duration)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {query.database}
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={getImpactColor(query.impact)} size="sm">
                          {query.impact}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(query.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No slow queries detected
            </div>
          )}
        </div>
      )}
    </Card>
  );
}