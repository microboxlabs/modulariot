"use client";

import { useState } from "react";
import { Card, Badge, Tabs } from "flowbite-react";
import { Copy, Check, ChevronDown, ChevronRight } from "lucide-react";
import { ConnectionDetails } from "./protocol-helpers";

interface ConnectionCardProps {
  details: ConnectionDetails;
  badges?: string[];
}

export function ConnectionCard({ details, badges = [] }: ConnectionCardProps) {
  const [copied, setCopied] = useState(false);
  const [showParameters, setShowParameters] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      // TODO: Replace with proper toast notification
      console.log("Copied to clipboard");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <Card className="mb-4">
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">{details.title}</h3>
            <div className="flex gap-1">
              {badges.map((badge, index) => (
                <Badge key={index} color="info" size="sm">
                  {badge}
                </Badge>
              ))}
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-3">{details.description}</p>
        </div>

        <div className="relative">
          <div 
            className="bg-gray-50 border rounded-lg p-3 font-mono text-sm cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={() => handleCopy(details.uri)}
          >
            <div className="flex items-center justify-between">
              <span className="break-all pr-8">{details.uri}</span>
              <div className="absolute top-3 right-3">
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => setShowParameters(!showParameters)}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
          >
            {showParameters ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            View parameters
          </button>

          {showParameters && (
            <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {details.parameters.map((param, index) => (
                  <div key={index} className="space-y-1">
                    <div className="font-medium text-sm">{param.name}</div>
                    <div className="font-mono text-xs bg-white border rounded px-2 py-1">
                      {param.value}
                    </div>
                    {param.description && (
                      <div className="text-xs text-gray-500">{param.description}</div>
                    )}
                  </div>
                ))}
              </div>

              {details.sampleCode && (
                <div className="mt-4">
                  <h4 className="font-medium text-sm mb-2">Sample Code</h4>
                  <Tabs aria-label="Sample code tabs" variant="underline">
                    {Object.entries(details.sampleCode).map(([language, code]) => (
                      <Tabs.Item key={language} title={language.charAt(0).toUpperCase() + language.slice(1)}>
                        <div className="relative">
                          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
                            <code>{code}</code>
                          </pre>
                          <button
                            onClick={() => handleCopy(code)}
                            className="absolute top-2 right-2 p-1 hover:bg-gray-700 rounded"
                          >
                            {copied ? (
                              <Check className="h-3 w-3 text-green-400" />
                            ) : (
                              <Copy className="h-3 w-3 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </Tabs.Item>
                    ))}
                  </Tabs>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}