"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSWRConfig } from "swr";
import FormModal from "@/features/common/components/form-modal/form-modal";
import {
  DynamicFormField,
  useDynamicFormState,
} from "@/features/dynamic-forms";
import {
  useCalendarGroups,
  createCalendar,
} from "@/features/common/providers/client-api.provider";
import type {
  CalendarGroupResponse,
  CalendarRequest,
} from "@microboxlabs/miot-calendar-client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ShowNotification } from "@/features/notifications/notification";
import {
  CREATE_CALENDAR_FORM_CONFIG,
  normalizeCode,
} from "./create-calendar-modal.config";
import { GroupAutocompleteField } from "./group-autocomplete-field";

interface CreateCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Full calendar i18n dict (dict["calendar"]) */
  dict: I18nRecord;
  onCreated?: () => void;
}

export function CreateCalendarModal({
  isOpen,
  onClose,
  dict,
  onCreated,
}: Readonly<CreateCalendarModalProps>) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedGroupCode, setSelectedGroupCode] = useState("");
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(30);
  const { mutate } = useSWRConfig();
  const { groups } = useCalendarGroups();
  const router = useRouter();
  const params = useParams<{ lang: string }>();

  const { formValues, setFormValue, resetFormValues, isFieldVisible } =
    useDynamicFormState(isOpen, CREATE_CALENDAR_FORM_CONFIG);

  // Auto-derive code from name
  useEffect(() => {
    const name = formValues.name as string | undefined;
    if (name !== undefined) {
      setFormValue("code", normalizeCode(name));
    }
  }, [formValues.name, setFormValue]);

  const handleClose = useCallback(() => {
    resetFormValues();
    setSelectedGroupCode("");
    onClose();
  }, [resetFormValues, onClose]);

  const handleGroupCreated = useCallback(
    (group: CalendarGroupResponse) => {
      // Refresh the groups SWR cache so the new group appears immediately
      void mutate("/app/api/calendar/groups");
      setSelectedGroupCode(group.code);
    },
    [mutate]
  );

  const handleSubmit = useCallback(async () => {
    setIsProcessing(true);

    try {
      const body: CalendarRequest = {
        name: formValues.name as string,
        code: formValues.code as string,
        description: (formValues.description as string) || undefined,
        timezone: (formValues.timezone as string) || "UTC",
        active: (formValues.active as boolean) ?? true,
        groups: selectedGroupCode ? [selectedGroupCode] : [],
        autoSlotManager: true,
      };

      // Debug: log the request body
      console.log("[CreateCalendarModal] Submitting calendar:", body);

      const calendar = await createCalendar(body);
      await mutate("/app/api/calendar");
      ShowNotification({
        type: "success",
        message: tr("create.successNotification", dict),
      });
      handleClose();
      onCreated?.();
      const queryParams = new URLSearchParams();
      if (selectedGroupCode) queryParams.set("groupCode", selectedGroupCode);
      if (slotDurationMinutes !== 30) queryParams.set("slotDuration", String(slotDurationMinutes));
      const queryString = queryParams.toString();
      router.push(
        `/${params.lang}/calendar/${calendar.id}/planning${queryString ? `?${queryString}` : ""}`
      );
    } catch (err) {
      ShowNotification({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : tr("create.errorNotification", dict),
      });
    } finally {
      setIsProcessing(false);
    }
  }, [
    formValues,
    selectedGroupCode,
    slotDurationMinutes,
    mutate,
    dict,
    handleClose,
    onCreated,
    router,
    params.lang,
  ]);

  // Fields rendered via DynamicFormField (all except "groups" handled by GroupAutocompleteField)
  const standardFields = CREATE_CALENDAR_FORM_CONFIG.fields;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={handleClose}
      title={tr("create.title", dict)}
      subtitle={tr("create.subtitle", dict)}
      submitLabel={tr("create.submit", dict)}
      isProcessing={isProcessing}
      onSubmit={handleSubmit}
      size="2xl"
    >
      <div className="flex flex-col gap-4">
        {/* name, code, description, timezone */}
        {standardFields
          .filter((f) => f.name !== "active")
          .map((field) => (
            <DynamicFormField
              key={field.name}
              field={field}
              value={formValues[field.name] ?? field.defaultValue ?? ""}
              onChange={(value) => setFormValue(field.name, value)}
              isVisible={isFieldVisible(field)}
              translate={(key) => tr(key, dict)}
            />
          ))}

        {/* Group autocomplete/autocreate */}
        <GroupAutocompleteField
          groups={groups}
          value={selectedGroupCode}
          onChange={setSelectedGroupCode}
          onGroupCreated={handleGroupCreated}
          dict={dict}
        />

        {/* Slot duration (testing) */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="slotDuration"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Slot Duration (minutes)
          </label>
          <input
            id="slotDuration"
            type="number"
            min={5}
            max={480}
            step={5}
            value={slotDurationMinutes}
            onChange={(e) => setSlotDurationMinutes(Number(e.target.value))}
            className="rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
          />
        </div>

        {/* active checkbox */}
        {standardFields
          .filter((f) => f.name === "active")
          .map((field) => (
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
