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
  BuildCredit,
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
    component.imageRepository,
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
        <Field
          label="Image repo"
          value={component.imageRepository}
          monospace
        />
        <Field label="Image tag" value={component.imageTag} monospace />
        <Field label="Source tag" value={component.sourceTag} monospace />
        <Field label="Image ref" value={component.imageRef} monospace />
      </dl>
    </section>
  );
}

function formatStat(value?: number) {
  return value === undefined ? "0" : new Intl.NumberFormat("en").format(value);
}

function CreditStat({
  label,
  value,
}: Readonly<{
  label: string;
  value?: number;
}>) {
  if (!value) {
    return null;
  }

  return (
    <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
      {formatStat(value)} {label}
    </span>
  );
}

function compactProfileInfo(credit: BuildCredit) {
  const parts = [credit.bio, credit.company, credit.location].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" | ");
  }

  if (credit.followers) {
    return `${formatStat(credit.followers)} GitHub follower${
      credit.followers === 1 ? "" : "s"
    }`;
  }

  if (credit.publicRepos) {
    return `${formatStat(credit.publicRepos)} public repos`;
  }

  return credit.profileName ?? credit.role;
}

function CreditAvatar({
  credit,
}: Readonly<{
  credit: BuildCredit;
}>) {
  const initials = credit.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div
      aria-hidden="true"
      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-50 bg-cover bg-center text-sm font-semibold text-blue-700 ring-2 ring-blue-100 dark:bg-blue-900/30 dark:text-blue-100 dark:ring-blue-800"
      style={
        credit.avatarUrl
          ? { backgroundImage: `url("${credit.avatarUrl}")` }
          : undefined
      }
    >
      {!credit.avatarUrl && initials}
    </div>
  );
}

function Credits({
  credits,
}: Readonly<{
  credits: BuildCredit[];
}>) {
  if (credits.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-gray-200 pt-3 dark:border-gray-700">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Credits
        </h3>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {credits.length} contributor{credits.length === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {credits.map((credit) => {
          const label = credit.username ? `@${credit.username}` : credit.name;
          const profileInfo = compactProfileInfo(credit);
          const title =
            credit.rank === 1 && credits.length > 1
              ? "Top contributor"
              : credit.role;

          return (
            <li
              className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800"
              key={`${credit.name}-${credit.email ?? credit.username ?? ""}`}
            >
              <div className="flex gap-3">
                <CreditAvatar credit={credit} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {credit.url ? (
                        <Link
                          className="truncate text-sm font-semibold text-gray-900 hover:underline dark:text-gray-100"
                          href={credit.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {label}
                        </Link>
                      ) : (
                        <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {label}
                        </span>
                      )}
                      {profileInfo && (
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {profileInfo}
                        </p>
                      )}
                    </div>
                    {credit.rank && (
                      <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-100">
                        #{credit.rank}
                      </span>
                    )}
                  </div>
                  {title && (
                    <p className="mt-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                      {title}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <CreditStat label="commits" value={credit.commitCount} />
                    <CreditStat label="files" value={credit.filesChanged} />
                    <CreditStat label="++" value={credit.additions} />
                    <CreditStat label="--" value={credit.deletions} />
                    <CreditStat label="impact" value={credit.impactScore} />
                    <CreditStat label="followers" value={credit.followers} />
                    <CreditStat label="repos" value={credit.publicRepos} />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
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
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Build deployed
          </p>
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

            <Credits credits={buildInfo.credits} />
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
