"use client";

import type { ReactNode } from "react";
import { Alert, Button, Spinner, TextInput } from "flowbite-react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { HiLockClosed } from "react-icons/hi";
import FormModal from "@/features/common/components/form-modal/form-modal";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { SettingsFormField } from "@/features/settings-admin/components/settings-form-field";
import {
  BUILT_IN_ENVIRONMENTS,
  findCredentialType,
  type CredentialTypeId,
} from "../credential.types";
import type {
  CredentialBaseFields,
  CredentialFormState,
  CredentialModalProps,
} from "../use-credential-form";
import { CredentialTypeLogo } from "./credential-type-logo";
import { EnvironmentSelect } from "./environment-select";
import {
  credentialSubmitLabel,
  DeleteHeaderAction,
  TestResultLine,
  UsedByPanel,
} from "./credential-modal-parts";

/** What a credential type contributes to an otherwise identical modal. */
export interface CredentialFormChrome {
  readonly typeId: CredentialTypeId;
  /**
   * Prefix for the identity field ids. Distinct per type so labels stay bound
   * to their own inputs if two forms are ever mounted at once.
   */
  readonly idPrefix: string;
  readonly addTitleKey: string;
  readonly editTitleKey: string;
  readonly subtitleKey: string;
  readonly logoAltKey: string;
}

type CredentialFormShellProps<T extends CredentialBaseFields> =
  CredentialModalProps<T> & {
    readonly chrome: CredentialFormChrome;
    /** The lifecycle from `useCredentialForm`, passed through whole. */
    readonly state: CredentialFormState<T>;
    /** The fields specific to this credential type, in their display order. */
    readonly children: ReactNode;
  };

/**
 * The modal every credential form is: header with the provider mark and a
 * delete affordance, name and environment, the type's own fields, a test
 * action, the blast radius when editing, and the storage notice.
 *
 * Only the middle section varies, so it arrives as `children` and everything
 * around it lives here once. That is what keeps a new credential type down to a
 * schema plus a fields component, instead of another copy of this file with
 * three lines changed — which is how the Entra, OAuth2 and Auth0 forms came to
 * share roughly two thirds of their content.
 */
export function CredentialFormShell<T extends CredentialBaseFields>({
  chrome,
  state,
  show,
  onClose,
  onSubmit,
  onDelete,
  editing = null,
  loading = false,
  environments = BUILT_IN_ENVIRONMENTS,
  dict,
  children,
}: CredentialFormShellProps<T>) {
  const { form, testing, testResult, runTest } = state;
  const isEdit = editing !== null;
  const type = findCredentialType(chrome.typeId);
  const { handleSubmit } = form;

  // The identity fields are the same two literal keys on every credential form
  // — `CredentialBaseFields` is exactly what T is constrained to include. But
  // react-hook-form's `Path<T>` and `FieldErrors<T>` stay unresolved while T is
  // generic, so proving that to the compiler would mean an assertion at every
  // single use below. One widening here instead, sound because nothing in this
  // component touches any other field: the type-specific ones are already
  // rendered by the time they arrive as `children`.
  const {
    register,
    control,
    formState: { errors },
  } = form as unknown as UseFormReturn<CredentialBaseFields>;

  const nameId = `${chrome.idPrefix}-name`;
  const environmentId = `${chrome.idPrefix}-environment`;

  return (
    <FormModal
      isOpen={show}
      onClose={onClose}
      size="3xl"
      title={
        isEdit
          ? trDynamic(chrome.editTitleKey, dict)
          : trDynamic(chrome.addTitleKey, dict)
      }
      subtitle={trDynamic(chrome.subtitleKey, dict)}
      icon={
        <CredentialTypeLogo
          logo={type?.logo}
          alt={trDynamic(chrome.logoAltKey, dict)}
          size={40}
        />
      }
      headerActions={
        isEdit && onDelete ? (
          <DeleteHeaderAction onDelete={onDelete} dict={dict} />
        ) : null
      }
      submitLabel={credentialSubmitLabel(loading, isEdit, dict)}
      isProcessing={loading}
      onSubmit={handleSubmit(onSubmit)}
      showCancelButton
      cancelLabel={tr("modal.cancel", dict)}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_200px]">
          <SettingsFormField
            id={nameId}
            label={tr("modal.name", dict)}
            error={trDynamic(errors.name?.message ?? "", dict)}
          >
            <TextInput
              id={nameId}
              placeholder={tr("modal.namePlaceholder", dict)}
              {...register("name")}
              color={errors.name ? "failure" : undefined}
            />
          </SettingsFormField>

          <SettingsFormField
            id={environmentId}
            label={tr("modal.environment", dict)}
            error={trDynamic(errors.environment?.message ?? "", dict)}
          >
            <Controller
              control={control}
              name="environment"
              render={({ field }) => (
                <EnvironmentSelect
                  id={environmentId}
                  value={field.value}
                  onChange={field.onChange}
                  options={environments}
                  invalid={Boolean(errors.environment)}
                  dict={dict}
                />
              )}
            />
          </SettingsFormField>
        </div>

        {children}

        {/* Testing lives here rather than on the list row: only some credential
            types can be verified on their own, so the action belongs with the
            record that knows whether it means anything. */}
        {type?.supportsTest && (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              color="light"
              disabled={testing || loading}
              onClick={handleSubmit(runTest)}
            >
              {testing ? (
                <Spinner size="sm" />
              ) : (
                tr("modal.testConnection", dict)
              )}
            </Button>
            {testResult && <TestResultLine result={testResult} dict={dict} />}
          </div>
        )}

        {isEdit && editing.usedBy.length > 0 && (
          <UsedByPanel credential={editing} dict={dict} />
        )}

        <Alert color="gray" icon={HiLockClosed}>
          <span className="text-xs">{tr("modal.secretNotice", dict)}</span>
        </Alert>
      </div>
    </FormModal>
  );
}
