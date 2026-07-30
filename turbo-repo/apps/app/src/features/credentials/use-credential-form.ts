"use client";

import { useEffect, useRef, useState } from "react";
import {
  useForm,
  type DefaultValues,
  type Resolver,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type {
  CredentialListItem,
  CredentialTestResult,
} from "./credential.types";

/**
 * The two fields every credential carries whatever grant it configures. Forms
 * differ below this line; nothing above it does.
 */
export interface CredentialBaseFields {
  readonly name: string;
  readonly environment: string;
}

/**
 * The props every credential modal takes. Declared once and passed through to
 * the shell as a unit rather than forwarded field by field: the plumbing was
 * identical in all three modals, and hand-forwarding an optional prop is a
 * silent failure — miss `onDelete` and the delete button just stops appearing,
 * with nothing to typecheck against.
 */
export interface CredentialModalProps<T extends CredentialBaseFields> {
  readonly show: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (data: T) => void;
  readonly onTest: (data: T) => Promise<CredentialTestResult>;
  /** Delete this credential — surfaced in the header when editing one. */
  readonly onDelete?: () => void;
  readonly editing?: CredentialListItem | null;
  readonly loading?: boolean;
  /** Selectable environments; users can still create one that isn't listed. */
  readonly environments?: readonly string[];
  readonly dict: I18nRecord;
}

/** What a credential type contributes to the shared form lifecycle. */
export interface CredentialFormConfig<T extends CredentialBaseFields> {
  /** Values a create form opens with, and what a reopened edit form falls back to. */
  readonly defaults: T;
  /** Validation for a new credential. */
  readonly schema: ZodType;
  /**
   * Validation for an existing one. Separate because the secret is write-only:
   * an edit form that leaves it blank keeps the stored value, so it cannot
   * carry the create form's "required" rule.
   */
  readonly editSchema: ZodType;
  /** Projects a stored credential back onto form fields. */
  readonly toFormValues: (editing: CredentialListItem) => T;
}

export type CredentialFormOptions<T extends CredentialBaseFields> =
  CredentialModalProps<T> & CredentialFormConfig<T>;

export interface CredentialFormState<T extends CredentialBaseFields> {
  readonly form: UseFormReturn<T>;
  readonly isEdit: boolean;
  readonly testing: boolean;
  readonly testResult: CredentialTestResult | null;
  readonly runTest: (data: T) => Promise<void>;
}

/**
 * Everything a credential form does that has nothing to do with which grant it
 * configures: pick the right schema for create vs edit, re-initialize when the
 * modal opens, and run a token grant on demand while tracking its outcome.
 *
 * Each credential type supplies its own field type, schemas and mapping; what
 * is shared here is the lifecycle, which was identical in all three forms and
 * is the part that is easy to get subtly wrong — a form that does not reset on
 * open shows the previous credential's values, which for a secret field is a
 * disclosure rather than a cosmetic bug.
 */
export function useCredentialForm<T extends CredentialBaseFields>(
  options: CredentialFormOptions<T>
): CredentialFormState<T> {
  const { show, defaults, schema, editSchema, toFormValues, onTest } = options;
  const editing = options.editing ?? null;

  const isEdit = editing !== null;
  const [testResult, setTestResult] = useState<CredentialTestResult | null>(
    null
  );
  const [testing, setTesting] = useState(false);

  const form = useForm<T>({
    // The schemas are concrete per credential type while T is generic here, so
    // the resolver's inferred field type cannot be matched up structurally.
    // Callers pair the schema with the type it validates.
    resolver: zodResolver(isEdit ? editSchema : schema) as Resolver<T>,
    defaultValues: defaults as DefaultValues<T>,
  });

  const { reset } = form;

  // `defaults` and `toFormValues` are configuration, not reactive inputs: the
  // form re-initializes when it opens or when the record changes, never because
  // the caller re-rendered. Holding them in a ref keeps the dependency list to
  // the two things that should retrigger it, so a caller passing an inline
  // object or arrow cannot spin this into a reset loop.
  const config = useRef({ defaults, toFormValues });
  config.current = { defaults, toFormValues };

  // Initialize when the modal opens so a reopened form never shows stale input.
  useEffect(() => {
    if (!show) return;
    setTestResult(null);
    const { defaults: fallback, toFormValues: project } = config.current;
    reset((editing ? project(editing) : fallback) as DefaultValues<T>);
  }, [show, editing, reset]);

  async function runTest(data: T) {
    setTesting(true);
    try {
      setTestResult(await onTest(data));
    } finally {
      setTesting(false);
    }
  }

  return { form, isEdit, testing, testResult, runTest };
}
