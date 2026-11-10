"use client";

import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { TreatmentsRequest } from "@/app/api/treatments/route.type";
import {
  guardedRequestTreatment,
  RECORD_HANDLING_TYPE,
  treatmentSaveErrorKey,
  type EngineTreatmentProgress,
} from "./prototype-api-guard";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { Button, Textarea } from "flowbite-react";
import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ShowNotification } from "@/features/notifications/notification";
import { tr } from "@/features/i18n/tr.service";
import {
  FieldCard,
  PlainSection,
  StickyActions,
  BentoGrid,
  SelectableFieldControl,
  SelectableDropdown,
  useSelectableOptions,
  GeneralInfoGrid,
  fieldLabel,
  fillTextarea,
} from "./prototype-form-kit";

export const HANDLING_OUTCOME_FIELD = "handling_outcome";

/** The text the case history and the close's `resolution` show. */
export function handlingDescription(outcome: string, note: string): string {
  return `Gestión: ${outcome} · Nota: ${note.trim()}`;
}

/**
 * "Registrar gestión": the operator handled the case without a call (for
 * example, checked the rest on the GPS). Saves a NOTE action with the
 * outcome and the note, then closes the case as handled.
 */
export default function PrototypeRecordHandling({
  dict,
  treatmentData,
  treatmentRequest,
  setTreatmentRequest,
  setIsMenuOpen,
}: Readonly<{
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
  treatmentRequest: TreatmentsRequest;
  setTreatmentRequest: (treatmentRequest: TreatmentsRequest) => void;
  setIsMenuOpen: (isMenuOpen: boolean) => void;
}>) {
  const router = useRouter();
  const { lang } = useParams<{ lang: string }>();
  const t = (k: string) => tr(`symptoms.${k}`, dict);
  const [outcomeId, setOutcomeId] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosingOnly, setIsClosingOnly] = useState(false);
  const submitting = useRef(false);
  const engineProgress = useRef<EngineTreatmentProgress>({});

  const { options } = useSelectableOptions(HANDLING_OUTCOME_FIELD);
  const outcomeIds = outcomeId.split(",").filter(Boolean);
  const selectedOutcomes = options.filter((o) => outcomeIds.includes(o.id));
  const outcomeLabel = selectedOutcomes.map((o) => o.name).join(", ");
  const validDraft =
    selectedOutcomes.length > 0 &&
    selectedOutcomes.length === outcomeIds.length &&
    note.trim().length > 0;
  const canSave = isClosingOnly || validDraft;

  const handleSave = async () => {
    if (!canSave || submitting.current) return;
    submitting.current = true;
    setIsSubmitting(true);
    try {
      const description =
        engineProgress.current.pendingClose?.resolution ??
        handlingDescription(outcomeLabel, note);
      const response = await guardedRequestTreatment(
        {
          ...treatmentRequest,
          status: "active",
          treatment_type: RECORD_HANDLING_TYPE,
          description,
          driver_response: note.trim(),
        },
        {
          progress: engineProgress.current,
          action: { outcomeKey: outcomeId, outcomeLabel },
        }
      );
      setTreatmentRequest({
        ...treatmentRequest,
        status: "active",
        description,
        treatment_id: response.treatment_id,
      });
      setIsMenuOpen(false);
      router.push(`/${lang}/symptoms`);
      ShowNotification({ type: "success", message: t("treatment_saved") });
    } catch (error) {
      setIsClosingOnly(engineProgress.current.pendingClose !== undefined);
      ShowNotification({
        type: "error",
        message: t(treatmentSaveErrorKey(error)),
      });
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <BentoGrid>
      <p className="shrink-0 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-light text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
        {t(
          isClosingOnly ? "handling_close_pending" : "proto_handling_semantics"
        )}
      </p>

      <PlainSection title={t("proto_section_general")}>
        <GeneralInfoGrid dict={dict} treatmentData={treatmentData} />
      </PlainSection>

      <fieldset
        disabled={isSubmitting || isClosingOnly}
        className="flex min-w-0 flex-1 flex-col"
      >
        <legend className="sr-only">{t("proto_section_handling")}</legend>
        <FieldCard
          title={t("proto_section_handling")}
          action={
            <SelectableFieldControl
              fieldKey={HANDLING_OUTCOME_FIELD}
              dict={dict}
            />
          }
          grow
        >
          <div>
            <span className={fieldLabel}>{t("handling_outcome")} *</span>
            <SelectableDropdown
              fieldKey={HANDLING_OUTCOME_FIELD}
              ariaLabel={t("handling_outcome")}
              dict={dict}
              value={outcomeId}
              onSelect={(o) => setOutcomeId(o.id)}
              placeholder={t("handling_outcome_required")}
            />
          </div>
          <div className="flex flex-1 flex-col">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <label
                htmlFor="handling-note"
                className="text-xs font-medium text-gray-500 dark:text-gray-400"
              >
                {t("handling_note")} *
              </label>
              {note.trim().length === 0 && (
                <span className="text-xs text-red-500">
                  {t("handling_note_required")}
                </span>
              )}
            </div>
            <Textarea
              id="handling-note"
              className={fillTextarea}
              placeholder={t("handling_note_placeholder")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </FieldCard>
      </fieldset>

      <StickyActions>
        <Button
          color="blue"
          className="h-10 w-full"
          disabled={!canSave || isSubmitting}
          onClick={handleSave}
        >
          {t("save_and_close_handled")}
        </Button>
      </StickyActions>
    </BentoGrid>
  );
}
