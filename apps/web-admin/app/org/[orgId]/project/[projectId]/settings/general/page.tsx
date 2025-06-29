"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, TextInput, Card, Select, Modal, Alert, ModalHeader, ModalBody, ModalFooter, HelperText } from "flowbite-react";
import { Pause, Play, Globe, Truck, Trash2, BarChart3, CreditCard } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import CopyField from "@/app/components/CopyField";
import { DangerZone } from "@modulariot/ui/danger-zone";
import { useProject } from "@/lib/hooks/project";

const projectFormSchema = z.object({
  name: z.string().min(1, "Project name is required"),
});

type ProjectFormData = z.infer<typeof projectFormSchema>;

export default function GeneralSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const projectId = params.projectId as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const { data: project, error: projectError, isLoading } = useProject(projectId, orgId);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: '',
    },
  });

  useEffect(() => {
    if (project) {
      console.log("project", project);
      reset({
        name: project.name,
      });
    }
  }, [project, reset]);

  const onSubmit = async (data: ProjectFormData) => {
    setIsSubmitting(true);
    try {
      // TODO: Implement project update API
      await new Promise(resolve => setTimeout(resolve, 1000)); // Mock delay
      toast.success("Project updated successfully");
      reset(data);
    } catch (error) {
      toast.error("Failed to update project");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestart = async (restartType: string) => {
    try {
      const response = await fetch(`/api/organizations/${orgId}/projects/${projectId}/restart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: restartType }),
      });

      if (!response.ok) throw new Error("Failed to restart project");
      
      toast.success(`Project ${restartType} restart initiated`);
    } catch (error) {
      toast.error("Failed to restart project");
    }
  };

  const handlePauseResume = async () => {
    const action = "resume";
    
    try {
      const response = await fetch(`/api/projects/${projectId}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) throw new Error(`Failed to ${action} project`);
      
      toast.success(`Project ${action} initiated`);
    } catch (error) {
      toast.error(`Failed to ${action} project`);
    }
  };

  const handleDeleteProject = async () => {
    const response = await fetch(`/api/projects/${projectId}/delete`, {
      method: "DELETE",
    });

    if (!response.ok) throw new Error("Failed to delete project");
  };

  const handleDeleteSuccess = () => {
    toast.success("Project deleted successfully");
    router.push(`/org/${orgId}`);
  };

  const handleDeleteError = (error: Error) => {
    toast.error(error.message);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">General Settings</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Manage your project configuration and lifecycle.
        </p>
      </div>

      {/* Usage Banner */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-6 w-6 text-blue-500" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Monitor Usage</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Track your project's resource consumption and costs.
              </p>
            </div>
          </div>
          <Link href={`/org/${orgId}/project/${projectId}/settings/usage`}>
            <Button color="blue" size="sm">
              View Usage
            </Button>
          </Link>
        </div>
      </Card>

      {/* Project Name */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Project Name</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <TextInput
              {...register("name")}
              placeholder="Enter project name"
              color={errors.name ? "failure" : "gray"}
            />
            <HelperText>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {errors.name?.message}
              </span>
            </HelperText>
          </div>
          <div className="flex space-x-3">
            <Button
              type="submit"
              disabled={!isDirty || isSubmitting}
              color="blue"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
            <Button
              type="button"
              color="gray"
              onClick={() => reset()}
              disabled={!isDirty}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>

      {/* Project ID */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Project ID</h2>
        <CopyField label="Project ID" value={projectId} />
      </Card>

      {/* Lifecycle Actions */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Lifecycle Actions</h2>
        <div className="flex space-x-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Restart Project
            </label>
            <Select onChange={(e) => e.target.value && handleRestart(e.target.value)}>
              <option value="">Select restart type</option>
              <option value="soft">Soft Restart</option>
              <option value="hard">Hard Restart</option>
              <option value="full">Full Restart</option>
            </Select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Project Status
            </label>
            <Button
              onClick={handlePauseResume}
              color={"gray"}
              className="w-full"
            >
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Resume Project
                </>
            </Button>
          </div>
        </div>
      </Card>

      {/* Custom Domains */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Globe className="h-6 w-6 text-purple-500" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Custom Domains</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Connect custom domains to your project. Available on paid plans.
              </p>
            </div>
          </div>
            <Link href={`/org/${orgId}/project/${projectId}/settings/subscription`}>
              <Button color="purple" size="sm">
                <CreditCard className="h-4 w-4 mr-2" />
                Upgrade
              </Button>
            </Link>
        </div>
      </Card>

      {/* Transfer Project */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Truck className="h-6 w-6 text-orange-500" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Transfer Project</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Transfer this project to another organization.
              </p>
            </div>
          </div>
          <Button color="gray" size="sm" onClick={() => setShowTransferModal(true)}>
            Transfer
          </Button>
        </div>
      </Card>

      {/* Delete Project */}
      <DangerZone
        entityType="Project"
        entityName={project?.name ?? ""}
        deleter={async ()=>{}}
        entityId={projectId}
        url={`/api/organizations/${orgId}/projects/${projectId}`}
        disabled={isSubmitting}
        redirect={`/org/${orgId}`}
      />

      {/* Transfer Modal */}
      <Modal show={showTransferModal} onClose={() => setShowTransferModal(false)}>
        <ModalHeader>Transfer Project</ModalHeader>
        <ModalBody>
          <div className="text-center py-8">
            <Truck className="h-12 w-12 text-orange-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Transfer Project
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              This feature is coming soon. You'll be able to transfer projects between organizations.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="gray" onClick={() => setShowTransferModal(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}