"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  TextInput,
  Button,
  Alert,
  Label,
  Modal,
  Table,
  Badge,
  ModalHeader,
  ModalBody,
  HelperText,
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  ModalFooter,
} from "flowbite-react";
import { Plus, Copy, Trash2, ExternalLink } from "lucide-react";

const oauthAppSchema = z.object({
  name: z.string().min(1, "Application name is required"),
  description: z.string().optional(),
  redirectUri: z.string().url("Please enter a valid redirect URI"),
  website: z.string().url("Please enter a valid website URL").optional().or(z.literal("")),
});

type OAuthAppForm = z.infer<typeof oauthAppSchema>;

interface OAuthApp {
  id: string;
  name: string;
  description?: string;
  clientId: string;
  redirectUri: string;
  website?: string;
  createdAt: string;
  status: "active" | "inactive";
}

export default function OAuthAppsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // TODO: Load OAuth apps from API
  const [oauthApps] = useState<OAuthApp[]>([
    {
      id: "1",
      name: "Dashboard Integration",
      description: "Main dashboard OAuth application",
      clientId: "demo_client_12345",
      redirectUri: "https://example.com/auth/callback",
      website: "https://example.com",
      createdAt: "2024-01-15T10:30:00Z",
      status: "active",
    },
  ]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OAuthAppForm>({
    resolver: zodResolver(oauthAppSchema),
  });

  const onSubmit = async (data: OAuthAppForm) => {
    setIsCreating(true);
    setSuccess("");
    setError("");

    try {
      // TODO: Implement POST /api/org/[orgId]/oauth-apps API call
      const response = await fetch(`/api/organizations/${orgId}/oauth-apps`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to create OAuth application");
      }

      setSuccess("OAuth application created successfully!");
      setShowCreateModal(false);
      reset();
      // TODO: Refresh apps list
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create application");
    } finally {
      setIsCreating(false);
    }
  };

  const copyClientId = (clientId: string) => {
    navigator.clipboard.writeText(clientId);
    setSuccess("Client ID copied to clipboard!");
  };

  const deleteApp = async (appId: string) => {
    // TODO: Implement DELETE /api/org/[orgId]/oauth-apps/[appId] API call
    console.log("Delete app:", appId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            OAuth Applications
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Manage OAuth applications for third-party integrations.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Application
        </Button>
      </div>

      {success && (
        <Alert color="success" onDismiss={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert color="failure" onDismiss={() => setError("")}>
          {error}
        </Alert>
      )}

      <Card>
        {oauthApps.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableHeadCell>Application</TableHeadCell>
                <TableHeadCell>Client ID</TableHeadCell>
                <TableHeadCell>Redirect URI</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
                <TableHeadCell>Created</TableHeadCell>
                <TableHeadCell>Actions</TableHeadCell>
              </TableHead>
              <TableBody className="divide-y">
                {oauthApps.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {app.name}
                        </div>
                        {app.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {app.description}
                          </div>
                        )}
                        {app.website && (
                          <a
                            href={app.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <ExternalLink className="mr-1 h-3 w-3" />
                            Website
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <code className="text-sm">{app.clientId}</code>
                        <Button
                          size="xs"
                          color="gray"
                          onClick={() => copyClientId(app.clientId)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm">{app.redirectUri}</code>
                    </TableCell>
                    <TableCell>
                      <Badge color={app.status === "active" ? "green" : "red"}>
                        {app.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(app.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="xs"
                        color="failure"
                        onClick={() => deleteApp(app.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="mx-auto max-w-md">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                No OAuth applications
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Create your first OAuth application to enable third-party integrations.
              </p>
              <Button
                className="mt-4"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Application
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Modal show={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <ModalHeader>Create OAuth Application</ModalHeader>
        <ModalBody>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="name" className="mb-2 block">
                Application Name *
              </Label>
              <TextInput
                id="name"
                {...register("name")}
                color={errors.name ? "failure" : "gray"}
              />
            </div>
            <HelperText color={errors.name ? "failure" : "gray"}>
              {errors.name?.message}
            </HelperText>

            <div>
              <Label htmlFor="description" className="mb-2 block">
                Description
              </Label>
              <TextInput
                id="description"
                {...register("description")}
                placeholder="Brief description of your application"
                color={errors.description ? "failure" : "gray"}
              />
              <HelperText color={errors.description ? "failure" : "gray"}>
                {errors.description?.message}
              </HelperText>
            </div>

            <div>
              <Label htmlFor="redirectUri" className="mb-2 block">
                Redirect URI *
              </Label>
              <TextInput
                id="redirectUri"
                type="url"
                {...register("redirectUri")}
                placeholder="https://yourapp.com/auth/callback"
                color={errors.redirectUri ? "failure" : "gray"}
              />
              <HelperText color={errors.redirectUri ? "failure" : "gray"}>
                {errors.redirectUri?.message}
              </HelperText>
            </div>

            <div>
              <Label htmlFor="website" className="mb-2 block">
                Website
              </Label>
              <TextInput
                id="website"
                type="url"
                {...register("website")}
                placeholder="https://yourapp.com"
                color={errors.website ? "failure" : "gray"}
              />
              <HelperText color={errors.website ? "failure" : "gray"}>
                {errors.website?.message}
              </HelperText>
            </div>

            {error && (
              <Alert color="failure" className="mt-4">
                {error}
              </Alert>
            )}
          </form>
        </ModalBody>
        <ModalFooter>
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={isCreating}
          >
            {isCreating ? "Creating..." : "Create Application"}
          </Button>
          <Button color="gray" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}