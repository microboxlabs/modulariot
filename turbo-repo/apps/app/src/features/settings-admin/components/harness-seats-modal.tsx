"use client";

import { useEffect, useState } from "react";
import { Button } from "flowbite-react";
import { HiCheck } from "react-icons/hi";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";

export type BillingCycle = "monthly" | "yearly";

// 20% off the monthly per-seat rate when billed yearly.
const YEARLY_DISCOUNT = 0.2;

interface HarnessSeatsModalProps {
  readonly show: boolean;
  readonly currentSeats: number;
  readonly currentBillingCycle: BillingCycle;
  readonly minSeats: number;
  readonly pricePerSeat: number;
  readonly onClose: () => void;
  readonly onSave: (seats: number, billingCycle: BillingCycle) => void;
  readonly dict: I18nRecord;
}

export default function HarnessSeatsModal({
  show,
  currentSeats,
  currentBillingCycle,
  minSeats,
  pricePerSeat,
  onClose,
  onSave,
  dict,
}: HarnessSeatsModalProps) {
  const [seats, setSeats] = useState(currentSeats);
  const [billingCycle, setBillingCycle] =
    useState<BillingCycle>(currentBillingCycle);

  useEffect(() => {
    if (!show) return;
    setSeats(currentSeats);
    setBillingCycle(currentBillingCycle);
  }, [show, currentSeats, currentBillingCycle]);

  const adjustSeats = (delta: number) =>
    setSeats((current) => Math.max(minSeats, current + delta));

  const yearlyPricePerSeat = Math.round(pricePerSeat * (1 - YEARLY_DISCOUNT));
  const monthlyTotal = seats * pricePerSeat;
  const yearlyTotal = seats * yearlyPricePerSeat * 12;

  const isDirty =
    seats !== currentSeats || billingCycle !== currentBillingCycle;

  return (
    <AbsoluteModal
      selected={show}
      setSelected={onClose}
      maxWidth="42rem"
      className="w-full rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex w-full flex-col gap-8 p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {tr("title", dict)}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {tr("description", dict)}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <BillingCard
            selected={billingCycle === "monthly"}
            onSelect={() => setBillingCycle("monthly")}
            label={tr("monthlyLabel", dict)}
            total={monthlyTotal}
            unit={tr("monthlyUnit", dict)}
            pricePerSeat={pricePerSeat}
            perSeatSuffix={tr("perSeatSuffix", dict)}
            seats={seats}
            currentSeats={currentSeats}
            minSeats={minSeats}
            onAdjustSeats={adjustSeats}
            seatsRowLabel={tr("seatsRowLabel", dict)}
            totalLabel={tr("totalLabel", dict)}
            noChangeLabel={tr("diffNoChange", dict)}
            diffLabel={(diff) =>
              trDynamic(diff > 0 ? "diffMore" : "diffFewer", dict, {
                count: String(Math.abs(diff)),
              })
            }
          />
          <BillingCard
            selected={billingCycle === "yearly"}
            onSelect={() => setBillingCycle("yearly")}
            label={tr("yearlyLabel", dict)}
            badge={tr("savePercent", dict, {
              percent: String(Math.round(YEARLY_DISCOUNT * 100)),
            })}
            total={yearlyTotal}
            unit={tr("yearlyUnit", dict)}
            pricePerSeat={yearlyPricePerSeat}
            perSeatSuffix={tr("perSeatSuffix", dict)}
            seats={seats}
            currentSeats={currentSeats}
            minSeats={minSeats}
            onAdjustSeats={adjustSeats}
            seatsRowLabel={tr("seatsRowLabel", dict)}
            totalLabel={tr("totalLabel", dict)}
            noChangeLabel={tr("diffNoChange", dict)}
            diffLabel={(diff) =>
              trDynamic(diff > 0 ? "diffMore" : "diffFewer", dict, {
                count: String(Math.abs(diff)),
              })
            }
          />
        </div>

        <Button
          color="blue"
          type="button"
          size="lg"
          disabled={!isDirty}
          onClick={() => onSave(seats, billingCycle)}
          className="w-full font-medium"
        >
          {tr("save", dict)}
        </Button>
      </div>
    </AbsoluteModal>
  );
}

interface BillingCardProps {
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly label: string;
  readonly badge?: string;
  readonly total: number;
  readonly unit: string;
  readonly pricePerSeat: number;
  readonly perSeatSuffix: string;
  readonly seats: number;
  readonly currentSeats: number;
  readonly minSeats: number;
  readonly onAdjustSeats: (delta: number) => void;
  readonly seatsRowLabel: string;
  readonly totalLabel: string;
  readonly noChangeLabel: string;
  readonly diffLabel: (diff: number) => string;
}

function BillingCard({
  selected,
  onSelect,
  label,
  badge,
  total,
  unit,
  pricePerSeat,
  perSeatSuffix,
  seats,
  currentSeats,
  minSeats,
  onAdjustSeats,
  seatsRowLabel,
  totalLabel,
  noChangeLabel,
  diffLabel,
}: BillingCardProps) {
  const diff = seats - currentSeats;
  // `total / seats` is this card's effective per-seat rate for its billing
  // cycle (already includes the yearly x12), so this scales exactly with diff.
  const priceDiff = diff * (total / seats);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`flex cursor-pointer flex-col gap-4 rounded-xl border-2 p-5 text-left transition-all ${
        selected
          ? "border-blue-600 bg-blue-50/60 shadow-sm dark:border-blue-500 dark:bg-blue-900/10"
          : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {label}
          </span>
          {badge && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {badge}
            </span>
          )}
        </div>
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            selected
              ? "border-blue-600 bg-blue-600"
              : "border-gray-300 dark:border-gray-600"
          }`}
        >
          {selected && <HiCheck className="h-3 w-3 text-white" />}
        </span>
      </div>

      {/* Hero number: the unit price — the totals section below covers the
          resolved cost for the chosen seat count. */}
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          ${pricePerSeat}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {perSeatSuffix}
        </span>
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {seatsRowLabel}
          </span>
          <div className="flex items-center gap-1 rounded-lg bg-gray-100 px-1.5 py-1 dark:bg-gray-700/50">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAdjustSeats(-1);
              }}
              disabled={seats <= minSeats}
              className="flex h-6 w-6 items-center justify-center rounded-full text-gray-600 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-medium text-gray-900 dark:text-white">
              {seats}
            </span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAdjustSeats(1);
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              +
            </button>
          </div>
        </div>

        <p
          className={`text-right text-xs font-medium ${
            diff === 0
              ? "text-gray-400 dark:text-gray-500"
              : diff > 0
                ? "text-green-600 dark:text-green-400"
                : "text-amber-600 dark:text-amber-400"
          }`}
        >
          {diff === 0
            ? noChangeLabel
            : `${diffLabel(diff)} · ${priceDiff >= 0 ? "+" : "-"}$${Math.abs(
                priceDiff
              ).toLocaleString()}${unit}`}
        </p>

        <div className="flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-700/60">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {totalLabel}
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            ${total.toLocaleString()} {unit}
          </span>
        </div>
      </div>
    </div>
  );
}
