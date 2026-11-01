"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  TextInput,
  ToggleSwitch,
} from "flowbite-react";
import { HiOutlineInboxIn } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useTripsPermission } from "../monitors/monitors-api";
import { PlanEditor } from "../monitors/plan-params";
import { keyFromName } from "../key-from-name";
import {
  FEED_ADMIN,
  FEED_RESOURCES,
  saveFeed,
  useFeeds,
  type Feed,
  type FeedBody,
  type FeedResource,
} from "./feeds-api";

const KEY = /^[a-z0-9][a-z0-9-]*$/;

const NEW_FEED: FeedBody = {
  name: "",
  country: null,
  stages: [],
  arrivalStage: "",
  requiredResources: ["truck", "driver"],
  registersResources: true,
  active: true,
};

function bodyOf(f: Feed): FeedBody {
  return {
    name: f.name,
    country: f.country ?? null,
    stages: f.stages,
    arrivalStage: f.arrivalStage,
    requiredResources: f.requiredResources,
    registersResources: f.registersResources,
    active: f.active,
  };
}

/** Creates a feed (`feed` null) or edits one; the key is set once. */
function FeedModal({
  open,
  feed,
  taken,
  listReady,
  listError,
  onClose,
  d,
  md,
}: Readonly<{
  open: boolean;
  feed: Feed | null;
  taken: string[];
  listReady: boolean;
  listError?: string;
  onClose: () => void;
  d: I18nRecord;
  md: I18nRecord;
}>) {
  const [body, setBody] = useState<FeedBody>(NEW_FEED);
  const [key, setKey] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBody(feed ? bodyOf(feed) : NEW_FEED);
    setKey(feed?.feedKey ?? "");
    setKeyEdited(false);
    setError(null);
  }, [open, feed]);

  const creating = feed === null;
  const stageTypes = body.stages.map((s) => s.stageType);
  const arrival = stageTypes.includes(body.arrivalStage)
    ? body.arrivalStage
    : "";
  const keyProblem = creating && (!KEY.test(key) || taken.includes(key));
  const country = body.country?.trim().toUpperCase() || null;
  const countryProblem = country !== null && !/^[A-Z]{2}$/.test(country);
  const invalid =
    !body.name.trim() ||
    keyProblem ||
    countryProblem ||
    body.stages.length === 0 ||
    !arrival ||
    (creating && !listReady);

  const change = (patch: Partial<FeedBody>) => setBody({ ...body, ...patch });
  const toggleResource = (r: FeedResource, on: boolean) =>
    change({
      requiredResources: on
        ? [...body.requiredResources, r]
        : body.requiredResources.filter((x) => x !== r),
    });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveFeed(
        key,
        { ...body, name: body.name.trim(), country, arrivalStage: arrival },
        creating
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show={open} onClose={() => !busy && onClose()} size="xl">
      <ModalHeader>
        {creating ? tr("newFeed", d) : tr("editFeed", d, { name: feed.name })}
      </ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="feed-name">{tr("name", d)}</Label>
              <TextInput
                id="feed-name"
                sizing="sm"
                disabled={busy}
                value={body.name}
                onChange={(e) => {
                  change({ name: e.target.value });
                  if (creating && !keyEdited)
                    setKey(keyFromName(e.target.value));
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="feed-key">{tr("key", d)}</Label>
              <TextInput
                id="feed-key"
                sizing="sm"
                className="font-mono"
                value={key}
                disabled={!creating || busy}
                onChange={(e) => {
                  setKey(e.target.value);
                  setKeyEdited(true);
                }}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {creating && taken.includes(key)
                  ? tr("keyTaken", d)
                  : tr("keyHint", d)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1 sm:w-1/2">
            <Label htmlFor="feed-country">{tr("country", d)}</Label>
            <TextInput
              id="feed-country"
              sizing="sm"
              disabled={busy}
              value={body.country ?? ""}
              placeholder="CL"
              maxLength={2}
              color={countryProblem ? "failure" : undefined}
              aria-invalid={countryProblem}
              aria-describedby="feed-country-hint"
              onChange={(e) =>
                change({ country: e.target.value.toUpperCase() || null })
              }
            />
            <p
              id="feed-country-hint"
              className="text-xs text-gray-500 dark:text-gray-400"
            >
              {tr("countryHint", d)}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {tr("stages", d)}
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {tr("stagesHint", d)}
            </p>
            <PlanEditor
              plan={body.stages}
              readOnly={busy}
              d={md}
              emptyText={tr("stagesEmpty", d)}
              onChange={(stages) => change({ stages })}
            />
          </div>

          <div className="flex flex-col gap-1 sm:w-1/2">
            <Label htmlFor="feed-arrival">{tr("arrivalStage", d)}</Label>
            <Select
              id="feed-arrival"
              sizing="sm"
              disabled={busy}
              value={arrival}
              onChange={(e) => change({ arrivalStage: e.target.value })}
            >
              <option value="" disabled>
                {tr("chooseStage", d)}
              </option>
              {stageTypes.map((s) => (
                <option key={s} value={s}>
                  {tr(`stages.${s}`, md)}
                </option>
              ))}
            </Select>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {tr("arrivalHint", d)}
            </p>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-gray-900 dark:text-white">
              {tr("requiredResources", d)}
            </legend>
            <div className="flex flex-wrap gap-4">
              {FEED_RESOURCES.map((r) => (
                <div key={r} className="flex items-center gap-2">
                  <Checkbox
                    id={`feed-resource-${r}`}
                    disabled={busy}
                    checked={body.requiredResources.includes(r)}
                    onChange={(e) => toggleResource(r, e.target.checked)}
                  />
                  <Label htmlFor={`feed-resource-${r}`}>
                    {tr(`resources.${r}`, d)}
                  </Label>
                </div>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1">
            <ToggleSwitch
              disabled={busy}
              checked={body.registersResources}
              label={tr("registersLabel", d)}
              onChange={(registersResources) => change({ registersResources })}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {body.registersResources
                ? tr("registersHint", d)
                : tr("registersOffHint", d)}
            </p>
          </div>

          <ToggleSwitch
            disabled={busy}
            checked={body.active}
            label={tr("activeLabel", d)}
            onChange={(active) => change({ active })}
          />
          {!body.active && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {tr("inactiveHint", d)}
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          {creating && !listReady && (
            <p className="text-sm text-gray-500">
              {listError ?? tr("loading", d)}
            </p>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button color="blue" disabled={invalid || busy} onClick={save}>
          {creating ? tr("create", d) : tr("save", d)}
        </Button>
        <Button color="alternative" disabled={busy} onClick={onClose}>
          {tr("cancel", d)}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

/**
 * The organization's feeds: the external sources that send its trips, each with the stages its
 * trips start with, the arrival stage, the resources a new trip needs, and whether it takes sends.
 */
export default function FeedsPanel({
  creating,
  onCreatingDone,
  d,
  md,
}: Readonly<{
  creating: boolean;
  onCreatingDone: () => void;
  d: I18nRecord;
  /** The monitors' dictionary: stage names and the plan editor. */
  md: I18nRecord;
}>) {
  const { data, error, isLoading } = useFeeds();
  const canEdit = useTripsPermission(FEED_ADMIN);
  const [editing, setEditing] = useState<Feed | null>(null);
  const feeds = data ?? [];

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {tr("title", d)}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("description", d)}
        </p>
      </div>

      {isLoading && <p className="text-sm text-gray-500">{tr("loading", d)}</p>}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error.message}
        </p>
      )}
      {data && feeds.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center dark:border-gray-700">
          <HiOutlineInboxIn className="h-6 w-6 text-gray-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("empty", d)}
          </p>
        </div>
      )}

      {feeds.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3">{tr("feed", d)}</th>
                <th className="px-4 py-3">{tr("stages", d)}</th>
                <th className="px-4 py-3">{tr("requiredResources", d)}</th>
                <th className="px-4 py-3">{tr("openServices", d)}</th>
                <th className="px-4 py-3">{tr("state", d)}</th>
                {canEdit && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {feeds.map((f) => (
                <tr
                  key={f.feedKey}
                  className="border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {f.name}
                    </div>
                    <div className="font-mono text-xs text-gray-400">
                      {f.feedKey}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {f.stages.map((s) => (
                        <Badge
                          key={s.stageType}
                          color={
                            s.stageType === f.arrivalStage ? "info" : "gray"
                          }
                          title={
                            s.stageType === f.arrivalStage
                              ? tr("arrivalStage", d)
                              : undefined
                          }
                        >
                          {tr(`stages.${s.stageType}`, md)}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {f.requiredResources.length === 0
                      ? tr("noResources", d)
                      : f.requiredResources
                          .map((r) => tr(`resources.${r}`, d))
                          .join(", ")}
                  </td>
                  <td className="px-4 py-3">{f.openServices}</td>
                  <td className="px-4 py-3">
                    <Badge color={f.active ? "success" : "gray"}>
                      {f.active ? tr("active", d) : tr("inactive", d)}
                    </Badge>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="xs"
                        color="light"
                        onClick={() => setEditing(f)}
                      >
                        {tr("edit", d)}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FeedModal
        open={creating || editing !== null}
        feed={editing}
        taken={feeds.map((f) => f.feedKey)}
        listReady={data !== undefined && !isLoading && !error}
        listError={error?.message}
        onClose={() => {
          setEditing(null);
          onCreatingDone();
        }}
        d={d}
        md={md}
      />
    </section>
  );
}
