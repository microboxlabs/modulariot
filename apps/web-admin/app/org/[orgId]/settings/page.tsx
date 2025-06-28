"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, TextInput, Button, Alert, Label, HelperText } from "flowbite-react";
import { Save } from "lucide-react";
import { DangerZone } from "@modulariot/ui/danger-zone";
import { deleteOrganization } from "@/lib/api/org";
import { useOrganization } from "@/lib/hooks/organization";

const orgSettingsSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  description: z.string().optional(),
  website: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  billingEmail: z.string().email("Please enter a valid email address"),
});

type OrgSettingsForm = z.infer<typeof orgSettingsSchema>;

export default function GeneralSettingsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const { data: organization, error: orgError, isLoading } = useOrganization(orgId, {
    keepPreviousData: true,
  });
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<OrgSettingsForm>({
    resolver: zodResolver(orgSettingsSchema),
    defaultValues: {
      name: organization?.name ?? "",
    },
  });

  useEffect(() => {
    if (organization) {
      reset({
        name: organization.name,
        // description: organization.description,
        // website: organization.website,
        // billingEmail: organization.billingEmail,
      });
    }
  }, [organization, reset]);

  const onSubmit = async (data: OrgSettingsForm) => {
    setIsSaving(true);
    setSuccess("");
    setError("");

    try {
      // TODO: Implement PATCH /api/org/[orgId] API call
      const response = await fetch(`/api/organizations/${orgId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to update organization settings");
      }

      setSuccess("Organization settings updated successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  // id: string;
  // slug: string;
  // createdAt: Date;
  // updatedAt: Date;
  // regionId: string;
  // superadminPassword: string;
  // organizationId: string;
  // securityMode: string;
  // apiSchema: string;
  // dbEngine: string;

  return (
    <div className="space-y-8">
      <Card>
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Organization Information
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Update your organization's basic information and settings.
            </p>
          </div>

          {success && (
            <Alert color="success" className="mb-4">
              {success}
            </Alert>
          )}

          {orgError && (
            <Alert color="failure" className="mb-4">
              {orgError.message}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <Label htmlFor="name" className="mb-2 block">
                  Organization Name *
                </Label>
                <TextInput
                  id="name"
                  {...register("name")}
                  color={errors.name ? "failure" : "gray"}
                />
                <HelperText>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                      {errors.name?.message}
                  </span>
              </HelperText>
              </div>

              <div>
                <Label htmlFor="billingEmail" className="mb-2 block">
                  Billing Email *
                </Label>
                <TextInput
                  id="billingEmail"
                  type="email"
                  {...register("billingEmail")}
                  color={errors.billingEmail ? "failure" : "gray"}
                />
                <HelperText>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                      {errors.billingEmail?.message}
                  </span>
              </HelperText>
              </div>
            </div>

            <div>
              <Label htmlFor="description" className="mb-2 block">
                Description
              </Label>
              <TextInput
                id="description"
                {...register("description")}
                placeholder="A brief description of your organization"
                color={errors.description ? "failure" : "gray"}
              />
              <HelperText>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                      {errors.description?.message}
                  </span>
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
                placeholder="https://example.com"
                color={errors.website ? "failure" : "gray"}
              />
              <HelperText>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                      {errors.website?.message}
                  </span>
              </HelperText>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isSaving}
                className="flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>{isSaving ? "Saving..." : "Save Changes"}</span>
              </Button>
            </div>
          </form>
        </div>
      </Card>

      <DangerZone
        entityType="Organization"
        entityName={organization?.name ?? ""}
        entityId={orgId}
        deleter={deleteOrganization}
        redirect="/org"
        url={`/api/organizations/${orgId}`}
        disabled={isSaving}
      />
    </div>
  );
}