"use client";

import { useState } from "react";
import { Card, Badge, Tabs, Button, TabItem } from "flowbite-react";
import { Copy, Check, ChevronDown, ChevronRight, Eye, EyeOff, ExternalLink } from "lucide-react";
import { ConnectionDetails } from "./protocol-helpers";

interface ConnectionCardProps {
  details: ConnectionDetails;
  badges?: string[];
  auth0Credentials?: {
    clientId: string;
    clientSecret: string;
    audience: string;
    grantType: string;
  };
}

export function ConnectionCard({ details, badges = [], auth0Credentials }: ConnectionCardProps) {
  const [copied, setCopied] = useState(false);
  const [showParameters, setShowParameters] = useState(false);
  const [copiedStepIndex, setCopiedStepIndex] = useState<number | null>(null);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [copiedParam, setCopiedParam] = useState<string | null>(null);

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

  const handleStepCopy = async (text: string, stepIndex: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStepIndex(stepIndex);
      setTimeout(() => setCopiedStepIndex(null), 2000);
      
      // TODO: Replace with proper toast notification
      console.log("Copied to clipboard");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleParamCopy = async (text: string, paramName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedParam(paramName);
      setTimeout(() => setCopiedParam(null), 2000);
      
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

        {/* Show steps if available, otherwise show the original URI */}
        {details.steps && details.steps.length > 0 ? (
          <div className="space-y-4">
            {details.steps.map((step, index) => (
              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm">{step.title}</h4>
                  <button
                    onClick={() => handleStepCopy(step.code, index)}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                  >
                    {copiedStepIndex === index ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-600 mb-2">{step.description}</p>
                {/* Add tabs for different languages if sampleCode is available */}
                {step.sampleCode && Object.keys(step.sampleCode).length > 0 ? (
                  <Tabs aria-label="Code samples" variant="underline">
                    {Object.entries(step.sampleCode).map(([language, code]) => (
                      <TabItem key={language} title={language.charAt(0).toUpperCase() + language.slice(1)}>
                        <div className="relative">
                          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                            <code>{code}</code>
                          </pre>
                          <button
                            onClick={() => handleStepCopy(code, index)}
                            className="absolute top-2 right-2 p-1 hover:bg-gray-700 rounded"
                          >
                            {copiedStepIndex === index ? (
                              <Check className="h-3 w-3 text-green-400" />
                            ) : (
                              <Copy className="h-3 w-3 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </TabItem>
                    ))}
                  </Tabs>
                ) : (
                  <div className="bg-gray-900 text-gray-100 p-3 rounded text-xs font-mono overflow-x-auto">
                    <pre className="whitespace-pre-wrap">{step.code}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
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
        )}

        {/* Auth0 Credentials Form - only show for REST protocol when credentials are available */}
        {auth0Credentials && (
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
              View credentials
            </button>

            {showParameters && (
              <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Auth Configuration</h4>
                  <Button
                    size="xs"
                    color="light"
                    className="flex items-center gap-1"
                    onClick={() => window.open('https://docs.modulariot.com/auth0-setup', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Documentation
                  </Button>
                </div>

                <div className="space-y-3">
                  {/* Client ID */}
                  <div className="space-y-1">
                    <div className="font-medium text-xs text-gray-700">Client ID</div>
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-xs bg-white border rounded px-3 py-2 flex-1 break-all">
                        {auth0Credentials.clientId}
                      </div>
                      <button
                        onClick={() => handleParamCopy(auth0Credentials.clientId, 'clientId')}
                        className="p-2 hover:bg-gray-200 rounded transition-colors"
                        title="Copy Client ID"
                      >
                        {copiedParam === 'clientId' ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Client Secret */}
                  <div className="space-y-1">
                    <div className="font-medium text-xs text-gray-700">Client Secret</div>
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-xs bg-white border rounded px-3 py-2 flex-1 break-all">
                        {showClientSecret ? auth0Credentials.clientSecret : '•'.repeat(40)}
                      </div>
                      <button
                        onClick={() => setShowClientSecret(!showClientSecret)}
                        className="p-2 hover:bg-gray-200 rounded transition-colors"
                        title={showClientSecret ? "Hide secret" : "Show secret"}
                      >
                        {showClientSecret ? (
                          <EyeOff className="h-3 w-3 text-gray-400" />
                        ) : (
                          <Eye className="h-3 w-3 text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() => handleParamCopy(auth0Credentials.clientSecret, 'clientSecret')}
                        className="p-2 hover:bg-gray-200 rounded transition-colors"
                        title="Copy Client Secret"
                      >
                        {copiedParam === 'clientSecret' ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Audience */}
                  <div className="space-y-1">
                    <div className="font-medium text-xs text-gray-700">Audience</div>
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-xs bg-white border rounded px-3 py-2 flex-1 break-all">
                        {auth0Credentials.audience}
                      </div>
                      <button
                        onClick={() => handleParamCopy(auth0Credentials.audience, 'audience')}
                        className="p-2 hover:bg-gray-200 rounded transition-colors"
                        title="Copy Audience"
                      >
                        {copiedParam === 'audience' ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Grant Type */}
                  <div className="space-y-1">
                    <div className="font-medium text-xs text-gray-700">Grant Type</div>
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-xs bg-white border rounded px-3 py-2 flex-1 break-all">
                        {auth0Credentials.grantType}
                      </div>
                      <button
                        onClick={() => handleParamCopy(auth0Credentials.grantType, 'grantType')}
                        className="p-2 hover:bg-gray-200 rounded transition-colors"
                        title="Copy Grant Type"
                      >
                        {copiedParam === 'grantType' ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}