"use client";

import FormModal from "@/features/common/components/form-modal/form-modal";
import type { DuplicateStrategy, SubmitFn } from "./engine/types";
import {
  BatchImporterView,
  useBatchImporter,
} from "./batch-importer";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  submit: SubmitFn;
  sourceKey: string;
  title: string;
  defaultStrategy?: DuplicateStrategy;
  sample?: string;
  acceptedFileTypes?: string;
  dictionary: I18nRecord;
}

export function BatchImporterModal({
  isOpen,
  onClose,
  submit,
  sourceKey,
  title,
  defaultStrategy,
  sample,
  acceptedFileTypes,
  dictionary,
}: Readonly<Props>) {
  const state = useBatchImporter({ submit, sourceKey, defaultStrategy });

  const submitLabel = state.importing
    ? tr("dashboard.dashlets.batchImport.importing", dictionary)
    : tr("dashboard.dashlets.batchImport.importN", dictionary, {
        count: String(state.summary.unprocessed),
      });

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={tr("dashboard.dashlets.batchImport.subtitle", dictionary)}
      size="7xl"
      submitLabel={submitLabel}
      cancelLabel={tr("common.close", dictionary)}
      showCancelButton
      isProcessing={state.importing || !state.importable}
      onSubmit={state.onImport}
    >
      <BatchImporterView
        state={state}
        sample={sample}
        acceptedFileTypes={acceptedFileTypes}
        dictionary={dictionary}
      />
    </FormModal>
  );
}
