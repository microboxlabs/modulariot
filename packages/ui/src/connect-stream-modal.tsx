"use client";

import { useState, useEffect } from "react";
import { Modal, Tabs, Spinner, ModalHeader, ModalBody } from "flowbite-react";
import { Server, Wifi, Waves, MessageCircle, Terminal } from "lucide-react";
import { ConnectionCard } from "./connection-card";
import { PROTOCOLS, getConnectionDetails } from "./protocol-helpers";

interface ConnectStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  projectId: string;
  onFetchCredentials?: (projectId: string) => Promise<{ apiKey: string }>;
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
  onFetchCredentials 
}: ConnectStreamModalProps) {
  const [activeTab, setActiveTab] = useState("rest");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && projectId) {
      fetchCredentials();
    }
  }, [isOpen, projectId]);

  const fetchCredentials = async () => {
    try {
      setLoading(true);
      if (onFetchCredentials) {
        const data = await onFetchCredentials(projectId);
        setApiKey(data.apiKey);
      } else {
        // Fallback for development
        setApiKey("miot_key_" + Math.random().toString(36).substr(2, 20));
      }
    } catch (error) {
      console.error("Failed to fetch credentials:", error);
      // Fallback for development
      setApiKey("miot_key_" + Math.random().toString(36).substr(2, 20));
    } finally {
      setLoading(false);
    }
  };

  if (!orgId || !projectId) {
    return null;
  }

  return (
    <Modal show={isOpen} onClose={onClose} size="4xl" className="max-h-[90vh] overflow-y-auto">
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
            onActiveTabChange={(tab) => setActiveTab(PROTOCOLS[tab].id)}
          >
            {PROTOCOLS.map((protocol) => {
              const IconComponent = ICON_MAP[protocol.icon as keyof typeof ICON_MAP];
              const connectionDetails = getConnectionDetails(protocol.id, orgId, projectId, apiKey ?? "");

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
                    />

                    {protocol.id === "rest" && (
                      <div className="bg-gray-50 border rounded-lg p-4">
                        <h4 className="font-medium mb-2">WebSocket Alternative</h4>
                        <ConnectionCard 
                          details={getConnectionDetails("websocket", orgId, projectId, apiKey ?? "")}
                          badges={["Real-time", "Bidirectional"]}
                        />
                      </div>
                    )}
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
              <li>• Keep your API keys secure and never commit them to version control</li>
              <li>• Use environment variables for production deployments</li>
              <li>• Rotate credentials regularly from the project settings</li>
              <li>• Consider IP allowlisting for additional security</li>
            </ul>
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}