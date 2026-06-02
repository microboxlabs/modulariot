"use client";

import { useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSWRConfig } from "swr";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Label, TextInput } from "flowbite-react";
import FormModal from "@/features/common/components/form-modal/form-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { ShowNotification } from "@/features/notifications/notification";
import { generateSlug } from "./create-dashboard-modal.config";
import type { DashboardStorageSchema } from "../../types/dashboard.types";

const createDashboardSchema = z.object({
  name: z.string().trim().min(1, "dashboard.create.nameRequired"),
});

type CreateDashboardFormData = z.infer<typeof createDashboardSchema>;

const ApiErrorResponseSchema = z.object({
  error: z.string(),
  status: z.number(),
  code: z.string().optional(),
});

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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateDashboardFormData>({
    resolver: zodResolver(createDashboardSchema),
    defaultValues: { name: "" },
  });

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const onSubmit = useCallback(
    async (data: CreateDashboardFormData) => {
      const name = data.name.trim();
      if (!siteName) {
        ShowNotification({
          type: "error",
          message: tr("dashboard.create.siteRequired", dict),
        });
        return;
      }

      setIsProcessing(true);

      try {
        const slug = generateSlug(name);
        if (!slug) {
          ShowNotification({
            type: "error",
            message: tr("dashboard.create.nameInvalid", dict),
          });
          return;
        }

        // Check if a dashboard with this slug already exists
        let checkRes: Response;
        try {
          checkRes = await fetch(
            `/app/api/dashboard/config?site=${encodeURIComponent(siteName)}&slug=${encodeURIComponent(slug)}`
          );
        } catch {
          ShowNotification({
            type: "error",
            message: tr("dashboard.create.errorNotification", dict),
          });
          return;
        }

        if (!checkRes.ok) {
          ShowNotification({
            type: "error",
            message: tr("dashboard.create.errorNotification", dict),
          });
          return;
        }

        const existing = (await checkRes.json()) as { data: unknown };
        if (existing.data != null) {
          ShowNotification({
            type: "error",
            message: tr("dashboard.create.duplicateSlug", dict),
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
          const errorBody = await res.json().catch(() => ({}));
          const parsed = ApiErrorResponseSchema.safeParse(errorBody);
          ShowNotification({
            type: "error",
            message:
              parsed.success && parsed.data.error
                ? parsed.data.error
                : tr("dashboard.create.errorNotification", dict),
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
    },
    [siteName, mutate, dict, handleClose, router, params.lang]
  );

  return (
    <FormModal
      isOpen={isOpen}
      onClose={handleClose}
      title={tr("dashboard.create.title", dict)}
      subtitle={tr("dashboard.create.subtitle", dict)}
      submitLabel={tr("dashboard.create.submit", dict)}
      isProcessing={isProcessing}
      onSubmit={handleSubmit(onSubmit)}
      size="md"
    >
      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="name">{tr("dashboard.create.nameLabel", dict)}</Label>
          <TextInput
            id="name"
            placeholder={tr("dashboard.create.namePlaceholder", dict)}
            {...register("name")}
            color={errors.name ? "failure" : undefined}
          />
          {errors.name?.message && (
            <p className="mt-1 text-sm text-red-600">
              {trDynamic(errors.name.message, dict)}
            </p>
          )}
        </div>
      </div>
    </FormModal>
  );
}
