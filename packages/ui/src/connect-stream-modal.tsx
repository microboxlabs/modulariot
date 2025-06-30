"use client";

import { useState, useEffect, useCallback } from "react";
import { Modal, Tabs, Spinner, ModalHeader, ModalBody } from "flowbite-react";
import { Server, Wifi, Waves, MessageCircle, Terminal } from "lucide-react";
import { ConnectionCard } from "./connection-card";
import { PROTOCOLS, getConnectionDetails, Auth0Credentials, IngestConfig } from "./protocol-helpers";

interface CredentialsResponse {
  auth0: Auth0Credentials;
  ingest: IngestConfig;
  project: {
    id: string;
    name: string;
    organizationId: string;
  };
}

interface ConnectStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  projectId: string;
  onFetchCredentials?: (projectId: string) => Promise<{ apiKey: string }>;
  protocolsConfig: {
    [key: string]: {
      // icon: string;
      // badges: string[];
      serverUrl: string;
    };
  };
}

const ICON_MAP = {
  Server,
  Wifi,
  Waves,
  MessageCircle,
  Terminal,
};

export function ConnectStreamModal({ 
  isOpen, 
  onClose, 
  orgId, 
  projectId,
  onFetchCredentials,
  protocolsConfig
}: ConnectStreamModalProps) {
  const [, setActiveTab] = useState("rest");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState<CredentialsResponse | null>(null);

  const fetchCredentials = useCallback(async () => {
    try {
      setLoading(true);
      
      // Try to fetch real credentials from the new API endpoint
      const response = await fetch(`/api/organizations/${orgId}/projects/${projectId}/credentials`);
      if (response.ok) {
        const credentialsData: CredentialsResponse = await response.json();
        setCredentials(credentialsData);
        // Keep backward compatibility
        setApiKey("auth0_token_placeholder");
      } else if (onFetchCredentials) {
        // Fallback to old API
        const data = await onFetchCredentials(projectId);
        setApiKey(data.apiKey);
      } else {
        // Development fallback
        setApiKey("miot_key_" + Math.random().toString(36).substring(2, 22));
      }
    } catch (error) {
      console.error("Failed to fetch credentials:", error);
      // Fallback for development
      setApiKey("miot_key_" + Math.random().toString(36).substr(2, 20));
    } finally {
      setLoading(false);
    }
  }, [orgId, projectId, onFetchCredentials]);

  useEffect(() => {
    if (isOpen && projectId) {
      fetchCredentials();
    }
  }, [isOpen, projectId, fetchCredentials]);

  if (!orgId || !projectId) {
    return null;
  }

  return (
    <Modal show={isOpen} onClose={onClose} size="4xl">
      <ModalHeader className="border-b">
        <div className="flex items-center justify-between w-full">
          <div>
            <h2 className="text-xl font-semibold">Connect your stream</h2>
            <p className="text-gray-600 text-sm mt-1">
              Get connection strings & environment variables for this project
            </p>
          </div>
        </div>
      </ModalHeader>

      <ModalBody className="p-6">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Spinner size="lg" />
            <span className="ml-2">Loading credentials...</span>
          </div>
        ) : (
          <Tabs
            aria-label="Protocol tabs"
            variant="pills"
            onActiveTabChange={(tab: number) => setActiveTab(PROTOCOLS[tab]?.id ?? "rest")}
          >
            {PROTOCOLS.map((protocol) => {
              const IconComponent = ICON_MAP[protocol.icon as keyof typeof ICON_MAP];
              const connectionDetails = getConnectionDetails({
                protocol: protocol.id,
                orgId,
                projectId,
                apiKey: apiKey ?? "",
                serverUrl: protocolsConfig[protocol.id]?.serverUrl ?? "",
                auth0: credentials?.auth0,
                ingest: credentials?.ingest
              });

              return (
                <Tabs.Item
                  key={protocol.id}
                  title={
                    <div className="flex items-center gap-2">
                      <IconComponent className="h-4 w-4" />
                      <span>{protocol.name}</span>
                    </div>
                  }
                >
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-800">
                        <strong>{protocol.name}:</strong> {protocol.description}
                      </p>
                    </div>

                    <ConnectionCard 
                      details={connectionDetails} 
                      badges={protocol.badges}
                      auth0Credentials={protocol.id === "rest" && credentials ? {
                        clientId: credentials.auth0.clientId,
                        clientSecret: credentials.auth0.clientSecret,
                        audience: credentials.auth0.audience,
                        grantType: credentials.auth0.grantType
                      } : undefined}
                    />

                  </div>
                </Tabs.Item>
              );
            })}
          </Tabs>
        )}

        {!loading && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-800 mb-2">Security Notes</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• <strong>Never expose client_secret in UI</strong> - download service credentials from project settings</li>
              <li>• Access tokens expire every 30 days - implement automatic refresh in production</li>
              <li>• Keep credentials secure and never commit them to version control</li>
              <li>• Use environment variables for production deployments</li>
              <li>• Consider IP allowlisting for additional security</li>
            </ul>
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}