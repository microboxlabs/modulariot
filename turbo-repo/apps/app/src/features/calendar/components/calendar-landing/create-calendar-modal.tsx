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
  CalendarFilter,
  CalendarGroupResponse,
  CalendarRequest,
} from "@microboxlabs/miot-calendar-client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
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
      const filter: CalendarFilter = {};
      const filterOrigin = (formValues.filterOrigin as string)?.trim();
      const filterDestination = (
        formValues.filterDestination as string
      )?.trim();
      if (filterOrigin) filter.origin = filterOrigin;
      if (filterDestination) filter.destination = filterDestination;

      const body: CalendarRequest = {
        name: formValues.name as string,
        code: formValues.code as string,
        description: (formValues.description as string) || undefined,
        timezone: (formValues.timezone as string) || "UTC",
        parallelism: (formValues.parallelism as number) ?? 1,
        active: (formValues.active as boolean) ?? true,
        groups: selectedGroupCode ? [selectedGroupCode] : [],
        filter,
        autoSlotManager: true,
      };

      const calendar = await createCalendar(body);
      await mutate("/app/api/calendar");
      ShowNotification({
        type: "success",
        message: tr("create.successNotification", dict),
      });
      handleClose();
      onCreated?.();
      const groupQuery = selectedGroupCode
        ? `?groupCode=${selectedGroupCode}`
        : "";
      router.push(
        `/${params.lang}/calendar/${calendar.id}/planning${groupQuery}`
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
        {/* name, code, parallelism, description, timezone */}
        {standardFields
          .filter(
            (f) =>
              f.name !== "active" &&
              f.name !== "filterOrigin" &&
              f.name !== "filterDestination"
          )
          .map((field) => (
            <DynamicFormField
              key={field.name}
              field={field}
              value={formValues[field.name] ?? field.defaultValue ?? ""}
              onChange={(value) => setFormValue(field.name, value)}
              isVisible={isFieldVisible(field)}
              translate={(key) => trDynamic(key, dict)}
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

        {/* filter: origin + destination side by side */}
        <div className="flex gap-3">
          {standardFields
            .filter(
              (f) => f.name === "filterOrigin" || f.name === "filterDestination"
            )
            .map((field) => (
              <div key={field.name} className="flex-1">
                <DynamicFormField
                  field={field}
                  value={formValues[field.name] ?? field.defaultValue ?? ""}
                  onChange={(value) => setFormValue(field.name, value)}
                  isVisible={isFieldVisible(field)}
                  translate={(key) => trDynamic(key, dict)}
                />
              </div>
            ))}
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
              translate={(key) => trDynamic(key, dict)}
            />
          ))}
      </div>
    </FormModal>
  );
}
