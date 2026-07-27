"use client";

import { useMemo } from "react";
import { Alert } from "flowbite-react";
import {
  HiInformationCircle,
  HiArrowRight,
  HiExclamationCircle,
  HiCollection,
} from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { Section } from "./review-config-tab";
import {
  buildSampleContext,
  collectionsInScope,
  renderTemplate,
  sampleTemplateFor,
  GLOBAL_VARIABLE_GROUPS,
  VARIABLE_GROUPS,
} from "./review-integration.types";
import {
  checkCollectionTemplate,
  checkTemplate,
} from "./review-template-validation";
import { ReviewTemplateInput } from "./review-template-input";
import { ReviewCollectionInput } from "./review-collection-input";
import type {
  CollectionVariable,
  VariableGroup,
} from "./review-integration.types";
import {
  bindNameOf,
  collectionFallbackRoot,
  collectionPathOf,
  collectionScopeOf,
  contractRoots,
  scopeOfRow,
  type DispatchTarget,
  type DispatchTargetField,
} from "./review-binding.types";

const SAMPLE_CONTEXT = buildSampleContext();

/** One entry in the channel switcher: a stable key and its display name. */
export interface MappingChannelTab {
  readonly key: string;
  readonly label: string;
}

interface ReviewMappingTabProps {
  /** The chosen channel; its operation contract supplies the fields to map. */
  readonly target: DispatchTarget | undefined;
  readonly mappings: Record<string, string>;
  readonly onChange: (fieldId: string, template: string) => void;
  /** The column's attached channels, for switching which one is being mapped. */
  readonly channels?: readonly MappingChannelTab[];
  readonly activeChannelId?: string | null;
  readonly onSelectChannel?: (channelKey: string) => void;
  readonly dict: I18nRecord;
}

export function ReviewMappingTab({
  target,
  mappings,
  onChange,
  channels,
  activeChannelId,
  onSelectChannel,
  dict,
}: Readonly<ReviewMappingTabProps>) {
  const switcher =
    channels && channels.length > 1 && onSelectChannel ? (
      <ChannelSwitcher
        channels={channels}
        activeChannelId={activeChannelId ?? null}
        onSelectChannel={onSelectChannel}
        dict={dict}
      />
    ) : null;

  if (!target) {
    return (
      <div className="flex flex-col gap-4">
        {switcher}
        <Alert color="gray" icon={HiInformationCircle}>
          <span className="text-xs">{tr("mapping.noChannel", dict)}</span>
        </Alert>
      </div>
    );
  }

  // The contract's own roots, or null when this modulith does not report them. Null is
  // "unknown", not "the static four": a nested array introduces roots (`{{reasons.*}}`) that
  // save-time validation accepts, so enforcing the static set would paint the one correct
  // mapping red.
  const roots = contractRoots(target, mappings);
  const scopedGroups = VARIABLE_GROUPS.filter(
    (group) => group.scoped && roots?.includes(group.id)
  );

  return (
    <div className="flex flex-col gap-4">
      {switcher}
      <Section title={tr("mapping.title", dict)} help={tr("mapping.help", dict)}>
        <div className="flex flex-wrap gap-1.5">
          {GLOBAL_VARIABLE_GROUPS.map((group) => (
            <VariableChip key={group.id} group={group} dict={dict} />
          ))}
        </div>
        {/* Roots that exist only inside the array that supplies them. Listing them beside the
            global ones would suggest they resolve anywhere, which is why they are called out. */}
        {scopedGroups.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            <div className="flex flex-wrap gap-1.5">
              {scopedGroups.map((group) => (
                <VariableChip key={group.id} group={group} dict={dict} scoped />
              ))}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {tr("mapping.scopedHelp", dict)}
            </p>
          </div>
        )}
      </Section>

      <div className="flex flex-col gap-3">
        {target.fields.map((field) =>
          field.kind === "collection" ? (
            <CollectionField
              key={field.id}
              field={field}
              template={mappings[field.id] ?? ""}
              onChange={(value) => onChange(field.id, value)}
              roots={roots}
              fallback={collectionFallbackRoot(field, target)}
              collections={collectionsInScope(
                collectionScopeOf(field, target, mappings)
              )}
              dict={dict}
            />
          ) : (
            <MappingField
              key={field.id}
              field={field}
              template={mappings[field.id] ?? ""}
              onChange={(value) => onChange(field.id, value)}
              roots={roots}
              scope={scopeOfRow(field, target, mappings)}
              scopesKnown={roots !== null}
              dict={dict}
            />
          )
        )}
      </div>
    </div>
  );
}

/**
 * An array row: it names the context collection the array iterates, not a value.
 *
 * Rendered ahead of the rows it scopes, because answering it is what gives them their
 * variables — each element is bound under the last segment of this path, so pointing at
 * `content.reasons` is what makes the rows below read `{{reasons.*}}`.
 */
function CollectionField({
  field,
  template,
  onChange,
  roots,
  fallback,
  collections,
  dict,
}: Readonly<{
  field: DispatchTargetField;
  template: string;
  onChange: (value: string) => void;
  roots: readonly string[] | null;
  /** The contract's own source, used while this row is unmapped. */
  fallback: string | null;
  /** The arrays this row could point at, given the scope it sits in. */
  collections: readonly CollectionVariable[];
  dict: I18nRecord;
}>) {
  const check = useMemo(
    () => checkCollectionTemplate(template, roots),
    [template, roots]
  );
  const bound = bindNameOf(template) ?? fallback;

  // A path that is syntactically fine and still names no array here. Reported rather than
  // enforced: the catalogue covers the review event, and a contract may iterate a collection
  // it does not know about, which is the operator's call and not an error.
  const path = collectionPathOf(template);
  const unrecognised =
    !check.problem &&
    path !== null &&
    collections.length > 0 &&
    !collections.some((collection) => collection.path === path);

  return (
    <div className="rounded-lg border border-dashed border-primary-300 bg-primary-50/40 p-3 dark:border-primary-800 dark:bg-primary-900/10">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <HiCollection className="h-3.5 w-3.5 text-primary-500" />
        <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
          {field.id}
        </span>
        <span className="text-[10px] text-primary-600 dark:text-primary-400">
          {tr("mapping.collection", dict)}
        </span>
      </div>

      <p className="mb-1.5 text-[11px] text-gray-500 dark:text-gray-400">
        {tr("mapping.collectionHelp", dict)}
      </p>

      <ReviewCollectionInput
        value={template}
        onChange={onChange}
        collections={collections}
        placeholder={tr("mapping.collectionPlaceholder", dict)}
        color={check.status === "invalid" ? "failure" : "gray"}
        dict={dict}
      />

      {check.problem && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-red-600 dark:text-red-400">
          <HiExclamationCircle className="mt-px h-3 w-3 shrink-0" />
          <span>
            {trDynamic(
              `mapping.errors.${check.problem.code}`,
              dict,
              check.problem.params
            )}
          </span>
        </p>
      )}

      {/* Named a path, but not one holding an array here. Without this the row looks settled
          and the field it feeds simply never reaches the partner. */}
      {unrecognised && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          <HiExclamationCircle className="mt-px h-3 w-3 shrink-0" />
          <span>
            {trDynamic("mapping.collectionUnknown", dict, {
              path: path ?? "",
              options: collections.map((c) => `{{${c.path}}}`).join(", "),
            })}
          </span>
        </p>
      )}

      {/* What the rows below will read, so the consequence of this row is visible where it is
          decided rather than only in the rows it governs. */}
      {!check.problem && !unrecognised && bound && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
          <HiArrowRight className="h-3 w-3 shrink-0" />
          {trDynamic("mapping.collectionBinds", dict, { root: bound })}
        </p>
      )}
    </div>
  );
}

function VariableChip({
  group,
  scoped,
  dict,
}: Readonly<{ group: VariableGroup; scoped?: boolean; dict: I18nRecord }>) {
  const Icon = group.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
        scoped
          ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
          : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
      }`}
    >
      <Icon className="h-3 w-3" />
      {trDynamic(group.labelKey, dict)}
      {/* `.*` because a bare {{task}} is a whole object, which the server rejects. */}
      <code className="font-mono opacity-70">{`{{${group.id}.*}}`}</code>
    </span>
  );
}

/* -------------------------------------------------------------------------- */

/** Pills to switch which attached channel's mapping is on screen. */
function ChannelSwitcher({
  channels,
  activeChannelId,
  onSelectChannel,
  dict,
}: Readonly<{
  channels: readonly MappingChannelTab[];
  activeChannelId: string | null;
  onSelectChannel: (channelKey: string) => void;
  dict: I18nRecord;
}>) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        {tr("mapping.channel", dict)}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {channels.map((channel) => {
          const active = channel.key === activeChannelId;
          return (
            <button
              key={channel.key}
              type="button"
              onClick={() => onSelectChannel(channel.key)}
              aria-pressed={active}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              {channel.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function MappingField({
  field,
  template,
  onChange,
  roots,
  scope,
  scopesKnown,
  dict,
}: Readonly<{
  field: DispatchTargetField;
  template: string;
  onChange: (value: string) => void;
  /** The roots this contract accepts, so the row agrees with what the server would store. */
  roots: readonly string[] | null;
  /** The root this row is read under, as the draft mapping decides it. */
  scope: string | null;
  /** Whether the server told us which root this row renders under. */
  scopesKnown: boolean;
  dict: I18nRecord;
}>) {
  const check = useMemo(() => checkTemplate(template, roots), [template, roots]);
  const preview = useMemo(
    () => renderTemplate(template, SAMPLE_CONTEXT),
    [template]
  );

  const missing = field.required && !template.trim();
  const broken = check.status === "invalid";

  let color: "gray" | "success" | "failure" = "gray";
  if (missing || broken) {
    color = "failure";
  } else if (check.status === "valid") {
    color = "success";
  }

  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
          {field.id}
        </span>
        <span className="text-[10px] text-gray-400">
          {trDynamic(`mapping.types.${field.type}`, dict)}
        </span>
        <span
          className={`text-[10px] ${
            field.required
              ? "text-amber-600 dark:text-amber-400"
              : "text-gray-400"
          }`}
        >
          {field.required
            ? tr("mapping.required", dict)
            : tr("mapping.optional", dict)}
        </span>
      </div>

      {/* A worked example for *this* row: a leaf inside an array renders under that array's
          bind name, so a single global example would name a path that resolves nowhere here.
          Without the row's scope, a nested leaf gets the shape rather than a concrete path —
          naming an envelope variable there would be confidently wrong. */}
      <ReviewTemplateInput
        value={template}
        onChange={onChange}
        placeholder={
          scopesKnown || scope !== null || !field.id.includes(".")
            ? tr("mapping.templatePlaceholder", dict, {
                example: sampleTemplateFor(scope),
              })
            : tr("mapping.templatePlaceholderUnknown", dict)
        }
        color={color}
      />

      {/* Why the server would refuse this template, in its own terms. */}
      {check.problem && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-red-600 dark:text-red-400">
          <HiExclamationCircle className="mt-px h-3 w-3 shrink-0" />
          <span>
            {trDynamic(
              `mapping.errors.${check.problem.code}`,
              dict,
              check.problem.params
            )}
          </span>
        </p>
      )}

      {/* Live preview against sample data — withheld while the template is broken,
          since rendering a template that cannot be stored only misleads. */}
      {!broken && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs">
          <HiArrowRight className="h-3 w-3 shrink-0 text-gray-400" />
          {template.trim() ? (
            <code className="min-w-0 truncate font-mono text-gray-600 dark:text-gray-300">
              {preview || tr("mapping.previewEmpty", dict)}
            </code>
          ) : (
            <span className="text-gray-400">
              {missing
                ? tr("mapping.previewRequired", dict)
                : tr("mapping.previewUnset", dict)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
