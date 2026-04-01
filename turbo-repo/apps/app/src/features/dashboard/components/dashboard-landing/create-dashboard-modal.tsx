"use client";

import { useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSWRConfig } from "swr";
import FormModal from "@/features/common/components/form-modal/form-modal";
import { DynamicFormField, useDynamicFormState } from "@/features/dynamic-forms";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ShowNotification } from "@/features/notifications/notification";
import { CREATE_DASHBOARD_FORM_CONFIG, generateSlug } from "./create-dashboard-modal.config";
import type { DashboardStorageSchema } from "../../types/dashboard.types";

interface CreateDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  dict: I18nRecord;
  siteName: string | null;
}

export function CreateDashboardModal({
  isOpen,
  onClose,
  dict,
  siteName,
}: Readonly<CreateDashboardModalProps>) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { mutate } = useSWRConfig();
  const router = useRouter();
  const params = useParams<{ lang: string }>();

  const { formValues, setFormValue, resetFormValues, isFieldVisible } =
    useDynamicFormState(isOpen, CREATE_DASHBOARD_FORM_CONFIG);

  const handleClose = useCallback(() => {
    resetFormValues();
    onClose();
  }, [resetFormValues, onClose]);

  const handleSubmit = useCallback(async () => {
    const name = (formValues.name as string)?.trim();
    if (!name || !siteName) return;

    setIsProcessing(true);

    try {
      const slug = generateSlug(name);
      if (!slug) {
        ShowNotification({
          type: "error",
          message: tr("dashboard.create.errorNotification", dict),
        });
        return;
      }

      const config: DashboardStorageSchema = {
        version: 2,
        name,
        widgets: [],
        preferences: { editMode: false },
      };

      const res = await fetch("/app/api/dashboard/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: siteName, slug, config }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        ShowNotification({
          type: "error",
          message: (errorBody as Record<string, string>)?.error
            ?? tr("dashboard.create.errorNotification", dict),
        });
        return;
      }

      // Refresh the dashboard list in sidebar and landing page
      await mutate(
        `/app/api/dashboard/configs?site=${encodeURIComponent(siteName)}`
      );

      ShowNotification({
        type: "success",
        message: tr("dashboard.create.successNotification", dict),
      });

      handleClose();
      router.push(`/${params.lang}/home/${slug}`);
    } catch {
      ShowNotification({
        type: "error",
        message: tr("dashboard.create.errorNotification", dict),
      });
    } finally {
      setIsProcessing(false);
    }
  }, [formValues, siteName, mutate, dict, handleClose, router, params.lang]);

  const standardFields = CREATE_DASHBOARD_FORM_CONFIG.fields;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={handleClose}
      title={tr("dashboard.create.title", dict)}
      subtitle={tr("dashboard.create.subtitle", dict)}
      submitLabel={tr("dashboard.create.submit", dict)}
      isProcessing={isProcessing}
      onSubmit={handleSubmit}
      size="md"
    >
      <div className="flex flex-col gap-4">
        {standardFields.map((field) => (
          <DynamicFormField
            key={field.name}
            field={field}
            value={formValues[field.name] ?? field.defaultValue ?? ""}
            onChange={(value) => setFormValue(field.name, value)}
            isVisible={isFieldVisible(field)}
            translate={(key) => tr(key, dict)}
          />
        ))}
      </div>
    </FormModal>
  );
}
