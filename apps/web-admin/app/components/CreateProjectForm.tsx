"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, TextInput, Select, Spinner, Accordion, AccordionPanel, AccordionTitle, AccordionContent } from "flowbite-react";
import { Eye, EyeOff, Shield, Settings } from "lucide-react";
import { CTAButton } from "@modulariot/ui/cta-button";
import { PasswordGenerator } from "./PasswordGenerator";

const CreateProjectSchema = z.object({
  organizationId: z.string().min(1, "Organization is required"),
  name: z.string()
    .min(3, "Project name must be at least 3 characters")
    .max(20, "Project name must be less than 20 characters")
    .regex(/^[a-z0-9-]+$/, "Project name must contain only lowercase letters, numbers, and hyphens"),
  regionId: z.string().min(1, "Region is required"),
  superadminPassword: z.string().min(8, "Password must be at least 8 characters"),
  securityMode: z.enum(["api_and_connection", "connection_only"]),
  apiSchema: z.enum(["public", "dedicated"]),
  dbEngine: z.enum(["postgres", "postgres_vector"]),
});

type CreateProjectFormData = z.infer<typeof CreateProjectSchema>;

// TODO: Fetch from API
const REGIONS = [
  { value: "us-east", label: "US East (N. Virginia)" },
  { value: "us-west", label: "US West (Oregon)" },
  { value: "eu-central", label: "EU Central (Frankfurt)" },
  { value: "ap-southeast", label: "Asia Pacific (Singapore)" },
];

const SECURITY_MODES = [
  { value: "api_and_connection", label: "Ingest API + Connection String" },
  { value: "connection_only", label: "Connection String Only" },
];

const API_SCHEMAS = [
  { value: "public", label: "Public (default)" },
  { value: "dedicated", label: "Dedicated" },
];

const DB_ENGINES = [
  { value: "postgres", label: "PostgreSQL (default)" },
  { value: "postgres_vector", label: "PostgreSQL + Vector Extension (alpha)" },
];

interface CreateProjectFormProps {
  orgId: string;
  organizations: Array<{ id: string; name: string }>;
}

export function CreateProjectForm({ orgId, organizations }: CreateProjectFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateProjectFormData>({
    resolver: zodResolver(CreateProjectSchema),
    defaultValues: {
      organizationId: orgId,
      securityMode: "api_and_connection",
      apiSchema: "public",
      dbEngine: "postgres",
    },
  });

  const securityMode = watch("securityMode");
  const apiSchemaDisabled = securityMode === "connection_only";

  const onSubmit = async (data: CreateProjectFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create project");
      }

      const { projectId } = await response.json();
      router.push(`/org/${data.organizationId}/project/${projectId}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordGenerate = (password: string) => {
    setValue("superadminPassword", password);
  };

  const handleCancel = () => {
    router.push(`/org/${orgId}/projects`);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="pt-8 px-8">
        {/* Organization Selection */}
        <div className="space-y-2">
          <label htmlFor="organizationId" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Organization
          </label>
          <Select
            id="organizationId"
            aria-label="Organization selection"
            {...register("organizationId")}
            color={errors.organizationId ? "failure" : "gray"}
            disabled={isSubmitting}
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </Select>
          {errors.organizationId && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {errors.organizationId.message}
            </p>
          )}
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            Select the organization for this project
          </p>
        </div>

        {/* Project Name */}
        <div className="space-y-2">
          <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Project name
          </label>
          <TextInput
            id="name"
            type="text"
            placeholder="my-awesome-project"
            aria-label="Project name"
            {...register("name")}
            color={errors.name ? "failure" : "gray"}
            disabled={isSubmitting}
          />
          {errors.name && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {errors.name.message}
            </p>
          )}
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            Used for subdomain and platform name. Only lowercase letters, numbers, and hyphens.
          </p>
        </div>

        {/* Region */}
        <div className="space-y-2">
          <label htmlFor="regionId" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Region
          </label>
          <Select
            id="regionId"
            aria-label="Region selection"
            {...register("regionId")}
            color={errors.regionId ? "failure" : "gray"}
            disabled={isSubmitting}
          >
            <option value="">Select a region</option>
            {REGIONS.map((region) => (
              <option key={region.value} value={region.value}>
                {region.label}
              </option>
            ))}
          </Select>
          {errors.regionId && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {errors.regionId.message}
            </p>
          )}
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            Choose the geographic region for your project
          </p>
        </div>

        {/* Superadmin Password */}
        <div className="space-y-2">
          <label htmlFor="superadminPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Superadmin Password
          </label>
          <div className="flex gap-2 items-stretch">
            <div className="flex-1 relative">
              <TextInput
                id="superadminPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Enter a secure password"
                aria-label="Superadmin password"
                {...register("superadminPassword")}
                color={errors.superadminPassword ? "failure" : "gray"}
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                disabled={isSubmitting}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <div className="h-full flex items-stretch min-h-[42px]">
              <PasswordGenerator onGenerate={handlePasswordGenerate} disabled={isSubmitting} />
            </div>
          </div>
          {errors.superadminPassword && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {errors.superadminPassword.message}
            </p>
          )}
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            A secure superadmin password for your project (not a database password)
          </p>
        </div>
      </div>
      {/* Security Options */}
      <Accordion collapseAll theme={{
        base: "divide-y dark:divide-gray-700 dark:border-gray-700",
        flush: {
          off: "rounded-none border",
          on: "border-b"
        },
      }}>
        <AccordionPanel>
          <AccordionTitle className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300" theme={{
            "base": "flex w-full items-center justify-between p-5 text-left font-medium text-gray-500 rounded-none! dark:text-gray-400",
          }}>
            <span className="flex items-center gap-2">
              <Shield size={16} />
              Security Options
            </span>
          </AccordionTitle>
          <AccordionContent theme={{
            "base": "p-5",
          }}>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="securityMode" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Access Mode
                </label>
                <Select
                  id="securityMode"
                  aria-label="Security mode selection"
                  {...register("securityMode")}
                  color={errors.securityMode ? "failure" : "gray"}
                  disabled={isSubmitting}
                >
                  {SECURITY_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </Select>
                {errors.securityMode && (
                  <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                    {errors.securityMode.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="apiSchema" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Ingest API Schema
                </label>
                <Select
                  id="apiSchema"
                  aria-label="API schema selection"
                  {...register("apiSchema")}
                  color={errors.apiSchema ? "failure" : "gray"}
                  disabled={isSubmitting || apiSchemaDisabled}
                >
                  {API_SCHEMAS.map((schema) => (
                    <option key={schema.value} value={schema.value}>
                      {schema.label}
                    </option>
                  ))}
                </Select>
                {errors.apiSchema && (
                  <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                    {errors.apiSchema.message}
                  </p>
                )}
                {apiSchemaDisabled && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                    API schema options are disabled when using connection string only
                  </p>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionPanel>
        <AccordionPanel>
          <AccordionTitle className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <span className="flex items-center gap-2">
              <Settings size={16} />
              Advanced
            </span>
          </AccordionTitle>
          <AccordionContent>
            <div className="space-y-2">
              <label htmlFor="dbEngine" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Database Engine
              </label>
              <Select
                id="dbEngine"
                aria-label="Database engine selection"
                {...register("dbEngine")}
                color={errors.dbEngine ? "failure" : "gray"}
                disabled={isSubmitting}
              >
                {DB_ENGINES.map((engine) => (
                  <option key={engine.value} value={engine.value}>
                    {engine.label}
                  </option>
                ))}
              </Select>
              {errors.dbEngine && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {errors.dbEngine.message}
                </p>
              )}
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                Choose the database engine for your project
              </p>
            </div>
          </AccordionContent>
        </AccordionPanel>
      </Accordion>
      <div className="px-8 pb-8">
        {/* Submit Error */}
        {submitError && (
          <div className="p-4 text-sm text-red-700 bg-red-100 border border-red-300 rounded-md dark:bg-red-900 dark:text-red-300 dark:border-red-700" role="alert">
            {submitError}
          </div>
        )}

        {/* Form Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            color="gray"
            outline
            onClick={handleCancel}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <CTAButton
            type="submit"
            variant="primary"
            size="md"
            disabled={isSubmitting}
            className="flex-1 w-full"
          >
            {isSubmitting && <Spinner size="sm" className="mr-2" />}
            Create project
          </CTAButton>
        </div>

        {/* Helper Note */}
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center pt-2">
          You can modify project settings after creation.
        </p>
      </div>
    </form>
  );
}