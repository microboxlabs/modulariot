"use client";

import FormModal from "@/features/common/components/form-modal/form-modal";
import type { BatchImporterApi } from "./engine/api";
import type { IntrospectedParam } from "./engine/types";
import type { TransformStep } from "./engine/transforms";
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
  acceptedFileTypes?: string;
  dictionary: I18nRecord;
  /** RPC parameter schema — for the schema panel UI. */
  params?: IntrospectedParam[] | null;
  /** Optional filename prefix for the CSV download button. */
  filenameBase?: string;
  /** Persisted column transforms from the dashlet's widget config. */
  initialTransforms?: Record<string, TransformStep[]>;
  /** Bubble transform changes back to the dashlet for persistence. */
  onTransformsChange?: (next: Record<string, TransformStep[]>) => void;
  /** Persisted display-only date formats from the dashlet's widget config. */
  initialDateDisplayFormats?: Record<string, string>;
  /** Bubble display-format changes back to the dashlet for persistence. */
  onDateDisplayFormatsChange?: (next: Record<string, string>) => void;
}

export function BatchImporterModal({
  isOpen,
  onClose,
  api,
  title,
  acceptedFileTypes,
  dictionary,
  params,
  filenameBase,
  initialTransforms,
  onTransformsChange,
  initialDateDisplayFormats,
  onDateDisplayFormatsChange,
}: Readonly<Props>) {
  const state = useBatchImporter({
    api,
    params,
    filenameBase,
    initialTransforms,
    onTransformsChange,
    initialDateDisplayFormats,
    onDateDisplayFormatsChange,
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
