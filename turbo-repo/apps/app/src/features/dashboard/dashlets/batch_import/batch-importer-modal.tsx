"use client";

import FormModal from "@/features/common/components/form-modal/form-modal";
import type { BatchImporterApi } from "./engine/api";
import type {
  DuplicateStrategy,
  IntrospectedParam,
} from "./engine/types";
import {
  BatchImporterView,
  useBatchImporter,
} from "./batch-importer";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  api: BatchImporterApi;
  title: string;
  defaultStrategy?: DuplicateStrategy;
  acceptedFileTypes?: string;
  dictionary: I18nRecord;
  /** RPC parameter schema — for the schema panel UI. */
  params?: IntrospectedParam[] | null;
  /** Optional filename prefix for the CSV download button. */
  filenameBase?: string;
}

export function BatchImporterModal({
  isOpen,
  onClose,
  api,
  title,
  defaultStrategy,
  acceptedFileTypes,
  dictionary,
  params,
  filenameBase,
}: Readonly<Props>) {
  const state = useBatchImporter({
    api,
    defaultStrategy,
    params,
    filenameBase,
  });

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
      showHeaderClose
      isProcessing={state.importing || !state.importable}
      onSubmit={state.onImport}
    >
      <BatchImporterView
        state={state}
        acceptedFileTypes={acceptedFileTypes}
        dictionary={dictionary}
      />
    </FormModal>
  );
}
