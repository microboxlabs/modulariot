"use client";

import { Card, Button, Badge, Alert } from "flowbite-react";
import { FileText, Download, ExternalLink, Crown, Shield, Award } from "lucide-react";

interface LegalDocument {
  id: string;
  title: string;
  description: string;
  type: "policy" | "agreement" | "certificate";
  lastUpdated: string;
  downloadUrl?: string;
  externalUrl?: string;
  requiresPlan?: string[];
}

export default function LegalDocumentsPage() {
  // TODO: Load organization plan from API
  const organizationPlan = "free"; // stub - will be "free", "pro", "team", "enterprise"

  // TODO: Load legal documents from API
  const legalDocuments: LegalDocument[] = [
    {
      id: "1",
      title: "Privacy Policy",
      description: "Our commitment to protecting your data and privacy rights.",
      type: "policy",
      lastUpdated: "2024-01-15T10:00:00Z",
      externalUrl: "https://modulariot.com/privacy",
    },
    {
      id: "2",
      title: "Terms of Service",
      description: "The terms and conditions governing the use of our platform.",
      type: "agreement",
      lastUpdated: "2024-01-10T15:30:00Z",
      externalUrl: "https://modulariot.com/terms",
    },
    {
      id: "3",
      title: "Data Processing Agreement (DPA)",
      description: "GDPR-compliant data processing terms for enterprise customers.",
      type: "agreement",
      lastUpdated: "2024-01-05T12:00:00Z",
      downloadUrl: "/legal/dpa.pdf",
      requiresPlan: ["enterprise"],
    },
    {
      id: "4",
      title: "SOC 2 Type II Report",
      description: "Independent security audit report demonstrating our security controls.",
      type: "certificate",
      lastUpdated: "2023-12-01T09:00:00Z",
      downloadUrl: "/legal/soc2-report.pdf",
      requiresPlan: ["team", "enterprise"],
    },
    {
      id: "5",
      title: "HIPAA Business Associate Agreement",
      description: "For healthcare organizations requiring HIPAA compliance.",
      type: "agreement",
      lastUpdated: "2024-01-08T14:20:00Z",
      downloadUrl: "/legal/hipaa-baa.pdf",
      requiresPlan: ["enterprise"],
    },
    {
      id: "6",
      title: "Security Whitepaper",
      description: "Detailed overview of our security architecture and practices.",
      type: "policy",
      lastUpdated: "2024-01-12T11:45:00Z",
      downloadUrl: "/legal/security-whitepaper.pdf",
      requiresPlan: ["team", "enterprise"],
    },
  ];

  const getDocumentTypeIcon = (type: LegalDocument["type"]) => {
    switch (type) {
      case "policy":
        return FileText;
      case "agreement":
        return Shield;
      case "certificate":
        return Award;
      default:
        return FileText;
    }
  };

  const getDocumentTypeBadge = (type: LegalDocument["type"]) => {
    switch (type) {
      case "policy":
        return { color: "blue" as const, label: "Policy" };
      case "agreement":
        return { color: "green" as const, label: "Agreement" };
      case "certificate":
        return { color: "purple" as const, label: "Certificate" };
      default:
        return { color: "gray" as const, label: "Document" };
    }
  };

  const canAccessDocument = (document: LegalDocument) => {
    if (!document.requiresPlan) return true;
    return document.requiresPlan.includes(organizationPlan);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Legal Documents
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Access privacy policies, terms of service, and compliance documentation.
        </p>
      </div>

      <div className="grid gap-6">
        {legalDocuments.map((document) => {
          const Icon = getDocumentTypeIcon(document.type);
          const typeBadge = getDocumentTypeBadge(document.type);
          const hasAccess = canAccessDocument(document);

          return (
            <Card key={document.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <Icon className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {document.title}
                      </h3>
                      <Badge color={typeBadge.color} size="sm">
                        {typeBadge.label}
                      </Badge>
                      {document.requiresPlan && (
                        <Badge color="yellow" size="sm">
                          <Crown className="mr-1 h-3 w-3" />
                          {document.requiresPlan.join(" / ").toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {document.description}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Last updated: {new Date(document.lastUpdated).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {hasAccess ? (
                    <div className="flex space-x-2">
                      {document.downloadUrl && (
                        <Button size="sm" color="gray">
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      )}
                      {document.externalUrl && (
                        <Button
                          size="sm"
                          color="blue"
                          onClick={() => window.open(document.externalUrl, "_blank")}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          View
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="text-center">
                      <Button size="sm" color="gray" disabled>
                        <Crown className="mr-2 h-4 w-4" />
                        Upgrade Required
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {!hasAccess && (
                <Alert color="info" className="mt-4">
                  <div className="flex items-start">
                    <Crown className="h-5 w-5 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Upgrade Required</p>
                      <p className="text-sm mt-1">
                        This document is available for {document.requiresPlan?.join(" and ")} plan subscribers.
                        <Button size="xs" className="ml-2">
                          Upgrade Now
                        </Button>
                      </p>
                    </div>
                  </div>
                </Alert>
              )}
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="text-center py-8">
          <Shield className="mx-auto h-8 w-8 text-gray-400 mb-3" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Need Custom Legal Documentation?
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
            Our Enterprise plan includes custom legal documentation, 
            including BAAs, custom DPAs, and compliance certifications.
          </p>
          <div className="space-x-3">
            <Button>
              Contact Sales
            </Button>
            <Button color="gray">
              Learn More
            </Button>
          </div>
        </div>
      </Card>

      {/* TODO: Add legal document request form for enterprise customers */}
      <div className="text-sm text-gray-500 dark:text-gray-400">
        <p>
          For questions about our legal documentation or compliance certifications, 
          please contact our legal team at{" "}
          <a 
            href="mailto:legal@modulariot.com" 
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            legal@modulariot.com
          </a>
        </p>
      </div>
    </div>
  );
}