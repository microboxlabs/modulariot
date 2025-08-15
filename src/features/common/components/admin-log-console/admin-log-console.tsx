"use client";

import { useState, useEffect } from "react";
import { LogLevel, LogHandlerInfo } from "@/lib/logger";

interface LogHandlerTreeNode {
  id: string;
  name: string;
  level: LogLevel;
  children: Record<string, LogHandlerTreeNode>;
}

interface AdminLogConsoleProps {
  className?: string;
}

const LOG_LEVELS: LogLevel[] = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
];

const LOG_LEVEL_COLORS = {
  trace: "text-gray-500",
  debug: "text-blue-600",
  info: "text-green-600",
  warn: "text-yellow-600",
  error: "text-red-600",
  fatal: "text-red-800 font-bold",
};

export function AdminLogConsole({ className = "" }: AdminLogConsoleProps) {
  const [handlers, setHandlers] = useState<LogHandlerInfo[]>([]);
  const [tree, setTree] = useState<Record<string, LogHandlerTreeNode>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  // Fetch log handlers data
  const fetchHandlers = async () => {
    try {
      setLoading(true);
      const response = await fetch("/app/api/admin/logs");

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const data = await response.json();
      setHandlers(data.handlers);
      setTree(data.tree);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  // Update log level
  const updateLogLevel = async (
    handlerId: string,
    level: LogLevel,
    cascadeToChildren = false
  ) => {
    try {
      setUpdating(handlerId);
      const response = await fetch("/app/api/admin/logs", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          handlerId,
          level,
          cascadeToChildren,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update: ${response.statusText}`);
      }

      // Refresh data
      await fetchHandlers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update log level"
      );
    } finally {
      setUpdating(null);
    }
  };

  useEffect(() => {
    fetchHandlers();
  }, []);

  // Render tree node recursively
  const renderTreeNode = (
    node: LogHandlerTreeNode,
    depth = 0,
    parentId?: string
  ): JSX.Element => {
    return (
      <div key={node.id} className={`ml-${depth * 4}`}>
        <div className="flex items-center gap-4 p-2 bg-white rounded border mb-2">
          <div className="flex-1">
            <div className="font-medium">{node.name}</div>
            <div className="text-sm text-gray-500">
              ID: {node.id}
              {parentId && (
                <span className="ml-2 text-xs bg-gray-100 px-1 rounded">
                  parent: {parentId}
                </span>
              )}
            </div>
          </div>

          <div className={`font-mono text-sm ${LOG_LEVEL_COLORS[node.level]}`}>
            {node.level.toUpperCase()}
          </div>

          <select
            value={node.level}
            onChange={(e) =>
              updateLogLevel(node.id, e.target.value as LogLevel)
            }
            disabled={updating === node.id}
            className="border rounded px-2 py-1 text-sm"
          >
            {LOG_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level.toUpperCase()}
              </option>
            ))}
          </select>

          <button
            onClick={() => updateLogLevel(node.id, node.level, true)}
            disabled={
              updating === node.id || Object.keys(node.children).length === 0
            }
            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Apply this level to all child loggers"
          >
            Cascade
          </button>
        </div>

        {/* Render children */}
        {Object.entries(node.children).map(([childId, childNode]) =>
          renderTreeNode(childNode, depth + 1, node.id)
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Log Management Console
          </h2>
          <p className="text-gray-600">
            Manage log levels for all application handlers ({handlers.length}{" "}
            total)
          </p>
        </div>
        <button
          onClick={fetchHandlers}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
          Error: {error}
        </div>
      )}

      {updating && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded text-blue-700">
          Updating log level for: {updating}...
        </div>
      )}

      <div className="grid gap-6">
        {/* Log Level Reference */}
        <div className="bg-gray-50 p-4 rounded">
          <h3 className="font-medium text-gray-900 mb-3">
            Log Level Reference
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
            {LOG_LEVELS.map((level) => (
              <div key={level} className="flex items-center gap-2">
                <span className={`font-mono ${LOG_LEVEL_COLORS[level]}`}>
                  {level.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Lower levels include higher levels (debug includes info, warn,
            error, fatal)
          </p>
        </div>

        {/* Hierarchical Tree View */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Log Handlers Hierarchy
          </h3>
          <div className="space-y-2">
            {Object.entries(tree).map(([rootId, rootNode]) =>
              renderTreeNode(rootNode)
            )}
          </div>
        </div>

        {/* Flat List View */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            All Handlers (Flat View)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-4 py-2 text-left">
                    ID
                  </th>
                  <th className="border border-gray-200 px-4 py-2 text-left">
                    Name
                  </th>
                  <th className="border border-gray-200 px-4 py-2 text-left">
                    Level
                  </th>
                  <th className="border border-gray-200 px-4 py-2 text-left">
                    Parent
                  </th>
                  <th className="border border-gray-200 px-4 py-2 text-left">
                    Children
                  </th>
                  <th className="border border-gray-200 px-4 py-2 text-left">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {handlers.map((handler) => (
                  <tr key={handler.id} className="hover:bg-gray-50">
                    <td className="border border-gray-200 px-4 py-2 font-mono text-sm">
                      {handler.id}
                    </td>
                    <td className="border border-gray-200 px-4 py-2">
                      {handler.name}
                    </td>
                    <td className="border border-gray-200 px-4 py-2">
                      <span
                        className={`font-mono text-sm ${LOG_LEVEL_COLORS[handler.level]}`}
                      >
                        {handler.level.toUpperCase()}
                      </span>
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-sm text-gray-600">
                      {handler.parent || "-"}
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-sm text-gray-600">
                      {handler.children.length > 0
                        ? handler.children.join(", ")
                        : "-"}
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-sm text-gray-600">
                      {new Date(handler.created).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLogConsole;
