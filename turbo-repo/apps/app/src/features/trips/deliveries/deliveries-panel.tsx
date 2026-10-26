"use client";

import { useState } from "react";
import {
  Button,
  Checkbox,
  FileInput,
  Label,
  Select,
  TextInput,
} from "flowbite-react";
import { HiOutlinePaperClip } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { useTripsPermission } from "../monitors/monitors-api";
import { shortTime } from "../board/trip-card";
import type { MilestoneStatus } from "../board/board-api";
import {
  DELIVERY_OPERATE,
  PROOF_KINDS,
  createDelivery,
  nextStep,
  proofHref,
  stepAction,
  uploadProof,
  type Delivery,
  type ProofKind,
  type TripDeliveries,
} from "./deliveries-api";

const STATUS_STYLE: Record<MilestoneStatus, string> = {
  open: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  confirmed:
    "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,application/pdf";

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function NewDelivery({
  tripId,
  data,
  d,
}: Readonly<{ tripId: string; data: TripDeliveries; d: I18nRecord }>) {
  const [open, setOpen] = useState(false);
  const [customer, setCustomer] = useState("");
  const [reference, setReference] = useState("");
  const [chosen, setChosen] = useState<string[]>(() =>
    data.uncovered.map((m) => m.id)
  );
  const { busy, error, run } = useAction();
  if (!open) {
    return (
      <Button
        size="xs"
        color="light"
        onClick={() => {
          setChosen(data.uncovered.map((m) => m.id));
          setOpen(true);
        }}
      >
        {tr("sheet.deliveries.new", d)}
      </Button>
    );
  }
  const create = async () => {
    const done = await run(() =>
      createDelivery(tripId, {
        customer: customer.trim() || null,
        reference: reference.trim() || null,
        mandates: chosen,
      })
    );
    if (done) setOpen(false);
  };
  return (
    <div className="mt-2 space-y-2 rounded border border-gray-200 p-3 dark:border-gray-700">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <TextInput
          sizing="sm"
          placeholder={tr("sheet.deliveries.customer", d)}
          aria-label={tr("sheet.deliveries.customer", d)}
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
        />
        <TextInput
          sizing="sm"
          placeholder={tr("sheet.deliveries.reference", d)}
          aria-label={tr("sheet.deliveries.reference", d)}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </div>
      {data.uncovered.length > 0 && (
        <fieldset className="flex flex-wrap gap-3">
          <legend className="mb-1 text-xs text-gray-500 dark:text-gray-400">
            {tr("sheet.deliveries.loads", d)}
          </legend>
          {data.uncovered.map((m) => (
            <div key={m.id} className="flex items-center gap-1.5">
              <Checkbox
                id={`load-${m.id}`}
                checked={chosen.includes(m.id)}
                onChange={(e) =>
                  setChosen((c) =>
                    e.target.checked
                      ? [...c, m.id]
                      : c.filter((x) => x !== m.id)
                  )
                }
              />
              <Label htmlFor={`load-${m.id}`} className="text-xs">
                {m.code}
              </Label>
            </div>
          ))}
        </fieldset>
      )}
      <div className="flex gap-2">
        <Button
          size="xs"
          color="blue"
          disabled={busy || (data.uncovered.length > 0 && chosen.length === 0)}
          onClick={create}
        >
          {tr("sheet.deliveries.create", d)}
        </Button>
        <Button size="xs" color="light" onClick={() => setOpen(false)}>
          {tr("sheet.deliveries.cancel", d)}
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Upload({
  tripId,
  delivery,
  d,
}: Readonly<{ tripId: string; delivery: Delivery; d: I18nRecord }>) {
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<ProofKind>("signature");
  const [key, setKey] = useState(0);
  const { busy, error, run } = useAction();
  const send = async () => {
    if (!file) return;
    const done = await run(() => uploadProof(tripId, delivery.id, file, kind));
    if (done) {
      setFile(null);
      setKey((k) => k + 1);
    }
  };
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          sizing="sm"
          value={kind}
          aria-label={tr("sheet.deliveries.kind", d)}
          onChange={(e) => setKind(e.target.value as ProofKind)}
        >
          {PROOF_KINDS.map((k) => (
            <option key={k} value={k}>
              {trDynamic(`sheet.deliveries.kinds.${k}`, d)}
            </option>
          ))}
        </Select>
        <FileInput
          key={key}
          sizing="sm"
          className="max-w-sm"
          accept={ACCEPT}
          aria-label={tr("sheet.deliveries.file", d)}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Button size="xs" color="light" disabled={busy || !file} onClick={send}>
          {tr("sheet.deliveries.upload", d)}
        </Button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** The first step waits for a proof when the cycle asks for one and none came yet. */
function needsProofFirst(
  delivery: Delivery,
  next: ReturnType<typeof nextStep>,
  proofRequired: boolean
) {
  return (
    proofRequired &&
    delivery.proofs.length === 0 &&
    next?.step === delivery.steps[0]?.step
  );
}

function DeliveryCard({
  tripId,
  delivery,
  canOperate,
  proofRequired,
  d,
  lang,
}: Readonly<{
  tripId: string;
  delivery: Delivery;
  canOperate: boolean;
  proofRequired: boolean;
  d: I18nRecord;
  lang: string;
}>) {
  const { busy, error, run } = useAction();
  const next = nextStep(delivery);
  const needsProof = needsProofFirst(delivery, next, proofRequired);
  const loads = delivery.mandates.map((m) => m.code ?? m.id.slice(0, 8));
  return (
    <li className="rounded border border-gray-200 p-3 dark:border-gray-700">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {delivery.customer ?? tr("sheet.deliveries.noCustomer", d)}
          {delivery.reference && (
            <span className="ml-2 text-xs font-normal text-gray-500">
              {delivery.reference}
            </span>
          )}
        </span>
        <span className="text-xs text-gray-500">
          {loads.length > 0
            ? loads.join(" · ")
            : tr("sheet.deliveries.wholeTrip", d)}
        </span>
      </div>
      <ol className="mt-2 flex flex-wrap gap-1">
        {delivery.steps.map((s) => (
          <li
            key={s.step}
            className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status]}`}
            title={
              s.confirmedAt
                ? `${shortTime(s.confirmedAt, lang)} · ${s.confirmedBy ?? ""}`
                : trDynamic(`milestoneStatus.${s.status}`, d)
            }
          >
            {trDynamic(`lanes.${s.step}`, d)}
          </li>
        ))}
      </ol>
      {delivery.proofs.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs">
          {delivery.proofs.map((p) => {
            const href = proofHref(tripId, p);
            return (
              <li key={p.id} className="flex items-center gap-1.5">
                <HiOutlinePaperClip className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-gray-500">
                  {trDynamic(`sheet.deliveries.kinds.${p.kind}`, d)}
                </span>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-primary-700 hover:underline dark:text-primary-400"
                  >
                    {p.name ?? p.url ?? p.id.slice(0, 8)}
                  </a>
                ) : (
                  <span>{p.name}</span>
                )}
                <span className="text-gray-400">
                  {shortTime(p.receivedAt, lang)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {canOperate && needsProof && (
        <p className="mt-2 text-xs text-gray-500">
          {tr("sheet.deliveries.needsProof", d)}
        </p>
      )}
      {canOperate && next && !needsProof && (
        <div className="mt-2 flex gap-2">
          <Button
            size="xs"
            color="blue"
            disabled={busy}
            onClick={() =>
              run(() => stepAction(tripId, delivery.id, next.step, "confirm"))
            }
          >
            {tr("sheet.deliveries.confirm", d)}{" "}
            {trDynamic(`lanes.${next.step}`, d).toLowerCase()}
          </Button>
          {next.status === "pending" && (
            <Button
              size="xs"
              color="light"
              disabled={busy}
              onClick={() =>
                run(() => stepAction(tripId, delivery.id, next.step, "reject"))
              }
            >
              {tr("sheet.reject", d)}
            </Button>
          )}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {canOperate && <Upload tripId={tripId} delivery={delivery} d={d} />}
    </li>
  );
}

/** The trip's deliveries: their loads, proofs (POD) and steps, in the cycle of the trip's monitor. */
export function DeliveriesPanel({
  tripId,
  data,
  d,
  lang,
}: Readonly<{
  tripId: string;
  data: TripDeliveries;
  d: I18nRecord;
  lang: string;
}>) {
  const canOperate = useTripsPermission(DELIVERY_OPERATE);
  const cycle = data.cycle.steps
    .map((s) => trDynamic(`lanes.${s}`, d))
    .join(" → ");
  const canCreate =
    canOperate && (data.uncovered.length > 0 || data.deliveries.length === 0);
  return (
    <section className="flex flex-col gap-2 p-2">
      <div>
        <h2 className="text-md font-normal text-gray-700 dark:text-gray-300">
          {tr("sheet.deliveries.title", d)}
        </h2>
        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
          {cycle}
          {data.cycle.completesTrip &&
            ` · ${tr("sheet.deliveries.completes", d, {
              step: trDynamic(`lanes.${data.cycle.completesTrip}`, d),
            })}`}
        </span>
      </div>
      {data.deliveries.length === 0 && (
        <p className="text-sm text-gray-500">
          {tr("sheet.deliveries.none", d)}
        </p>
      )}
      <ul className="space-y-2">
        {data.deliveries.map((delivery) => (
          <DeliveryCard
            key={delivery.id}
            tripId={tripId}
            delivery={delivery}
            canOperate={canOperate}
            proofRequired={data.cycle.proofRequired}
            d={d}
            lang={lang}
          />
        ))}
      </ul>
      {data.uncovered.length > 0 && data.deliveries.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          {tr("sheet.deliveries.pendingLoads", d, {
            codes: data.uncovered.map((m) => m.code).join(" · "),
          })}
        </p>
      )}
      {canCreate && (
        <div className="mt-2">
          <NewDelivery tripId={tripId} data={data} d={d} />
        </div>
      )}
    </section>
  );
}
