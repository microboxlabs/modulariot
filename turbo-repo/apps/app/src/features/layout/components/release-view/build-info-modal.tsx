"use client";

import Link from "next/link";
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "flowbite-react";
import type {
  BuildInfo,
  BuildComponentInfo,
} from "@/features/common/providers/client-api.provider";
import AppLogo from "@/features/common/components/app-logo/app-logo";

function Field({
  label,
  value,
  monospace = false,
}: Readonly<{
  label: string;
  value?: string;
  monospace?: boolean;
}>) {
  if (!value) {
    return null;
  }

  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 text-sm">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd
        className={
          monospace
            ? "truncate font-mono text-xs text-gray-900 dark:text-gray-100"
            : "truncate text-gray-900 dark:text-gray-100"
        }
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function ComponentFields({
  name,
  component,
}: Readonly<{
  name: string;
  component: BuildComponentInfo;
}>) {
  const visibleValues = [
    component.version,
    component.tag,
    component.imageTag,
    component.sourceTag,
    component.imageRef,
  ];
  const hasValues = visibleValues.some(Boolean);
  if (!hasValues) {
    return null;
  }

  return (
    <section className="border-t border-gray-200 pt-3 dark:border-gray-700">
      <h3 className="mb-2 text-sm font-semibold capitalize text-gray-900 dark:text-gray-100">
        {name}
      </h3>
      <dl className="space-y-1">
        <Field label="Version" value={component.version} />
        <Field label="Tag" value={component.tag} monospace />
        <Field label="Image tag" value={component.imageTag} monospace />
        <Field label="Source tag" value={component.sourceTag} monospace />
        <Field label="Image ref" value={component.imageRef} monospace />
      </dl>
    </section>
  );
}

export default function BuildInfoModal({
  buildInfo,
  isOpen,
  onClose,
  releaseNotesVersion,
}: Readonly<{
  buildInfo: BuildInfo | null;
  isOpen: boolean;
  onClose: () => void;
  releaseNotesVersion?: string;
}>) {
  return (
    <Modal dismissible show={isOpen} onClose={onClose} size="3xl">
      <ModalHeader className="border-none">
        <div className="flex items-center gap-4">
          <AppLogo width={150} height={32} className="shrink-0" priority />
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              ModularIoT
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Build deployed
            </p>
          </div>
        </div>
      </ModalHeader>
      <ModalBody>
        {buildInfo ? (
          <div className="space-y-4">
            <dl className="space-y-1">
              <Field label="Channel" value={buildInfo.channel} />
              <Field
                label="Release"
                value={buildInfo.releaseVersion}
                monospace
              />
              <Field
                label="Release notes"
                value={releaseNotesVersion}
                monospace
              />
              <Field label="Stack" value={buildInfo.stackTag} monospace />
              <Field label="Commit" value={buildInfo.gitSha} monospace />
              <Field label="Built at" value={buildInfo.builtAt} />
              <Field label="Deployed at" value={buildInfo.deployedAt} />
            </dl>

            {Object.entries(buildInfo.components).map(([name, component]) => (
              <ComponentFields key={name} name={name} component={component} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Build information is not available for this deployment.
          </p>
        )}
      </ModalBody>
      <ModalFooter className="justify-end border-none">
        {releaseNotesVersion && (
          <Link
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 focus:ring-4 focus:ring-gray-100 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
            href={`/release/${releaseNotesVersion}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Release notes
          </Link>
        )}
        {buildInfo?.workflowRunUrl && (
          <Link
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 focus:ring-4 focus:ring-gray-100 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
            href={buildInfo.workflowRunUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Workflow
          </Link>
        )}
        <Button color="blue" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
}
