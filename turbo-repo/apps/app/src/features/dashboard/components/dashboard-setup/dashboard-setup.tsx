"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "flowbite-react";
import { HiArrowLeft, HiArrowRight, HiPlus } from "react-icons/hi2";
import type { DashboardPermissionsOptions } from "@microboxlabs/miot-dashboard-ui/react";
import StepProgress from "@/features/common/components/top-stepper/step-progress";
import TopStepper from "@/features/common/components/top-stepper/top-stepper";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { trDynamic } from "@/features/i18n/tr.service";
import { ShowNotification } from "@/features/notifications/notification";
import { DashletStep } from "./dashlet-step";
import { PermissionsStep } from "./permissions-step";
import { SETUP_STEPS, type SetupStep, type Visibility } from "./setup.types";
import { TagsStep } from "./tags-step";
import { usePrincipalDirectory } from "./use-principal-directory";
import { useSetupStep } from "./use-setup-step";
import {
  NO_PERMISSIONS,
  useSetupPermissions,
  type PermissionsState,
} from "./use-setup-permissions";

/** The sign-up flow's button shape. */
/** The setup card's footer buttons; the tags dialog uses them too. */
export const BUTTON_SHAPE = "rounded-lg font-semibold";

type T = (key: string, params?: Record<string, string>) => string;

interface DashboardSetupProps {
  dictionary: I18nRecord;
  /** Opens the dashlet picker. */
  onAdd: () => void;
  canManagePermissions: boolean;
  /** Where the permissions are read and saved; absent on the legacy host. */
  permissions?: DashboardPermissionsOptions;
  /** True once the setup has started: only its last step is offered then. */
  started: boolean;
  /** The dashboard's tags, where the tags step starts from. */
  initialTags: readonly string[];
  /** Saves the tags and ends the setup, on leaving the tags step. */
  onFinish?: (
    tags: string[] | undefined,
    visibility?: Visibility
  ) => Promise<boolean>;
  /** Who sees the dashboard, where the permissions step starts from. */
  visibility: Visibility;
  /** Saves who sees it, on leaving the permissions step. */
  onVisibilityChange?: (visibility: Visibility) => Promise<boolean>;
}

/**
 * A new dashboard's setup, one step at a time: who may use it, its tags,
 * then its first dashlet. Each step opens once the one before is done, and
 * the open step is kept in the URL.
 * Permissions are saved to the dashboard when their step is left; leaving
 * the tags step saves the tags and marks the setup started, so later visits
 * open on its last step alone.
 */
export function DashboardSetup(props: Readonly<DashboardSetupProps>) {
  // Read once: finishing the setup here keeps its steps on screen, on their
  // last one; it is the next visit that opens on that step alone.
  const [startedOnOpen] = useState(props.started);
  if (startedOnOpen) {
    return (
      <FirstDashletCard dictionary={props.dictionary} onAdd={props.onAdd} />
    );
  }
  return props.permissions && props.canManagePermissions ? (
    <ServerBackedSetup {...props} permissions={props.permissions} />
  ) : (
    <SetupFlow {...props} permissionsState={NO_PERMISSIONS} />
  );
}

function ServerBackedSetup(
  props: Readonly<
    DashboardSetupProps & { permissions: DashboardPermissionsOptions }
  >
) {
  const permissionsState = useSetupPermissions(props.permissions);
  return <SetupFlow {...props} permissionsState={permissionsState} />;
}

/**
 * A started dashboard that is still empty: the setup's last step alone, with
 * no steps around it. Its tags and permissions are changed from its settings.
 */
function FirstDashletCard({
  dictionary,
  onAdd,
}: Readonly<Pick<DashboardSetupProps, "dictionary" | "onAdd">>) {
  const t: T = (key, params) =>
    trDynamic(`dashboard.setup.dashlet.${key}`, dictionary, params);
  return (
    <section className="mx-auto w-full px-4 py-10 md:max-w-2xl">
      <div className="flex w-full flex-col rounded-2xl border border-gray-200 bg-white px-6 py-6 sm:px-8 lg:px-10 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("heading")}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("body")}
          </p>
        </div>
        <DashletStep onAdd={onAdd} t={t} />
      </div>
    </section>
  );
}

function rebaseTags(
  draft: { base: readonly string[]; tags: readonly string[] },
  current: readonly string[]
) {
  const removed = new Set(
    draft.base.filter((tag) => !draft.tags.includes(tag))
  );
  const added = draft.tags.filter((tag) => !draft.base.includes(tag));
  return [
    ...new Set([...current.filter((tag) => !removed.has(tag)), ...added]),
  ];
}

function SetupFlow({
  dictionary,
  onAdd,
  permissionsState,
  initialTags,
  onFinish,
  visibility,
  onVisibilityChange,
  started,
}: Readonly<DashboardSetupProps & { permissionsState: PermissionsState }>) {
  const t: T = (key, params) =>
    trDynamic(`dashboard.setup.${key}`, dictionary, params);
  const scoped =
    (prefix: string): T =>
    (key, params) =>
      t(`${prefix}.${key}`, params);
  const navigation = useRef<((target: number) => Promise<boolean>) | null>(
    null
  );
  const [active, setActive] = useSetupStep(
    (target) => navigation.current?.(target) ?? Promise.resolve(false)
  );
  // Opened at a later step (a reload, a shared link): the ones before it
  // count as done.
  const [unlocked, setUnlocked] = useState(active);
  useEffect(() => {
    setUnlocked((current) => Math.max(current, active));
  }, [active]);
  const [saving, setSaving] = useState(false);
  const directory = usePrincipalDirectory(permissionsState.canManage);
  const [tagsDraft, setTagsDraft] = useState<{
    base: readonly string[];
    tags: string[];
  } | null>(null);
  const tags =
    tagsDraft === null ? [...initialTags] : rebaseTags(tagsDraft, initialTags);
  const latestTags = useRef(tags);
  latestTags.current = tags;
  const transition = useRef(0);
  useEffect(
    () => () => {
      transition.current += 1;
    },
    []
  );
  const [visibilityDraft, setVisibilityDraft] = useState<Visibility | null>(
    null
  );
  const step: SetupStep = SETUP_STEPS[active] ?? "permissions";
  const isLast = active === SETUP_STEPS.length - 1;
  const busy = saving || permissionsState.busy || permissionsState.loading;
  const blocked = busy || permissionsState.error !== null;
  const visibilityChange =
    permissionsState.canManage && visibilityDraft !== visibility
      ? (visibilityDraft ?? undefined)
      : undefined;

  const savePermissions = async () => {
    if (!permissionsState.canManage) return true;
    const saved = await permissionsState.save();
    if (!saved) {
      ShowNotification({ type: "error", message: t("permissions.saveError") });
    }
    return saved;
  };

  /** Every forward route saves the steps it leaves, including stepper links. */
  const select = async (target: number) => {
    const attempt = ++transition.current;
    const requestedUrl = globalThis.location.href;
    const isCurrent = () =>
      attempt === transition.current &&
      globalThis.location.href === requestedUrl;
    if (target === active) return true;
    if (blocked) return false;
    if (target < active) {
      setActive(target);
      return true;
    }
    setSaving(true);
    try {
      if (step === "permissions" && !(await savePermissions())) return false;
      if (!isCurrent()) return false;
      let saved = true;
      if (SETUP_STEPS[target] === "dashlet") {
        saved =
          (await onFinish?.(
            tagsDraft === null ? undefined : latestTags.current,
            visibilityChange
          )) ?? true;
      } else if (visibilityChange !== undefined) {
        saved = (await onVisibilityChange?.(visibilityChange)) ?? true;
      }
      if (!isCurrent()) return false;
      if (!saved) {
        ShowNotification({
          type: "error",
          message: t("permissions.saveError"),
        });
        return false;
      }
      setVisibilityDraft(null);
      if (SETUP_STEPS[target] === "dashlet") setTagsDraft(null);
      setUnlocked((current) => Math.max(current, target));
      setActive(target);
      return true;
    } finally {
      setSaving(false);
    }
  };

  navigation.current = select;
  const changeTags = (next: string[]) =>
    setTagsDraft(
      JSON.stringify(next) === JSON.stringify(initialTags)
        ? null
        : { base: initialTags, tags: next }
    );
  const changeVisibility = (next: Visibility) =>
    setVisibilityDraft(next === visibility ? null : next);

  const addFirstDashlet = async () => {
    if (blocked) return;
    if (started) {
      onAdd();
      return;
    }
    setSaving(true);
    try {
      const saved =
        (await onFinish?.(
          tagsDraft === null ? undefined : latestTags.current,
          visibilityChange
        )) ?? true;
      if (saved) onAdd();
      else
        ShowNotification({
          type: "error",
          message: t("permissions.saveError"),
        });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto w-full px-4 py-10 md:max-w-2xl">
      <TopStepper
        steps={SETUP_STEPS.map((id) => ({ title: t(`steps.${id}`) }))}
        currentStepIndex={active}
        reachedStepIndex={unlocked}
        onSelect={(index) => void select(index)}
        disabled={blocked}
      />
      {permissionsState.error !== null && step !== "permissions" && (
        <div role="alert" className="mb-4 space-y-2 text-sm text-red-600">
          <p>
            {t(
              permissionsState.error === 409
                ? "permissions.conflictError"
                : "permissions.loadError"
            )}
          </p>
          <button
            type="button"
            className="underline"
            onClick={() => void permissionsState.retry()}
          >
            {t(
              permissionsState.error === 409
                ? "permissions.discardAndReload"
                : "permissions.retry"
            )}
          </button>
        </div>
      )}
      {/* Nothing in the card clips: the search's list has to float out of it.
          The sign-up flow's card: content, then a footer with the progress
          bar on its edge and the back / next buttons. */}
      <div className="flex w-full flex-col rounded-2xl border border-gray-200 bg-white transition-colors duration-200 dark:border-gray-700 dark:bg-gray-800">
        <div className="relative px-6 py-4 pt-6 sm:px-8 lg:px-10">
          <fieldset
            key={step}
            disabled={busy}
            className="min-w-0 animate-step-fade-in"
          >
            <div className="mb-6">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t(`${step}.heading`)}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t(`${step}.body`)}
                </p>
              </div>
            </div>
            {step === "permissions" && (
              <PermissionsStep
                assignments={permissionsState.assignments}
                onChange={permissionsState.onChange}
                principals={directory.principals}
                loading={directory.isLoading || permissionsState.busy}
                canManage={permissionsState.canManage}
                checkingAccess={permissionsState.loading}
                error={permissionsState.error}
                onRetry={() => void permissionsState.retry()}
                visibility={visibilityDraft ?? visibility}
                onVisibilityChange={
                  onVisibilityChange && permissionsState.canManage
                    ? changeVisibility
                    : undefined
                }
                t={scoped("permissions")}
              />
            )}
            {step === "tags" && (
              <TagsStep tags={tags} onChange={changeTags} t={scoped("tags")} />
            )}
            {step === "dashlet" && (
              <DashletStep
                onAdd={blocked ? undefined : () => void addFirstDashlet()}
                t={scoped("dashlet")}
              />
            )}
          </fieldset>
        </div>

        <div className="rounded-b-2xl bg-gray-50 dark:bg-gray-900/40">
          <StepProgress
            label={t("progress")}
            currentStepIndex={active}
            totalSteps={SETUP_STEPS.length}
            rounded={false}
          />
          <div className="flex items-center justify-between gap-3 p-4">
            <Button
              color="light"
              size="sm"
              type="button"
              disabled={blocked || active === 0}
              onClick={() => void select(Math.max(active - 1, 0))}
              className={`w-1/3 ${BUTTON_SHAPE}`}
            >
              <span className="flex items-center gap-1.5">
                <HiArrowLeft className="h-3.5 w-3.5" />
                {t("back")}
              </span>
            </Button>
            {isLast ? (
              <Button
                color="blue"
                size="sm"
                type="button"
                disabled={blocked}
                onClick={() => void addFirstDashlet()}
                className={`w-2/3 ${BUTTON_SHAPE}`}
              >
                <span className="flex items-center gap-1.5">
                  <HiPlus className="h-3.5 w-3.5" />
                  {t("dashlet.addTitle")}
                </span>
              </Button>
            ) : (
              <Button
                color="blue"
                size="sm"
                type="button"
                disabled={blocked}
                onClick={() => void select(active + 1)}
                className={`w-2/3 ${BUTTON_SHAPE}`}
              >
                <span className="flex items-center gap-1.5">
                  {t("next")}
                  <HiArrowRight className="h-3.5 w-3.5" />
                </span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
