"use client";

import {
  FaCalendarAlt,
  FaClipboardList,
  FaIdCard,
  FaMapMarkerAlt,
  FaTruck,
  FaUser,
} from "react-icons/fa";
import { FaShield } from "react-icons/fa6";
import { HiExclamationCircle, HiOutlineRefresh } from "react-icons/hi";
import CustomCard, {
  type InformationBadge,
} from "@/features/common/components/custom-card/custom-card";
import LoadableLabel from "@/features/common/components/loadable-label/loadable-label";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { BoardCard } from "../board/board-api";
import { shortTime, statusLabel } from "../board/trip-card";
import type { TripSheet } from "./sheet-api";

/** A bento cell: white, bordered, no shadow. */
export function Tile({
  className = "",
  children,
}: Readonly<{ className?: string; children: React.ReactNode }>) {
  return (
    <div
      className={`rounded-lg border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800 ${className}`}
    >
      {children}
    </div>
  );
}

const ICON = "h-4 w-4";

export function TripInfo({
  card,
  d,
  lang,
}: Readonly<{ card: BoardCard; d: I18nRecord; lang: string }>) {
  const badges: InformationBadge[] = [];
  if (card.regularized) {
    badges.push({
      text: tr("lanes.regularized", d),
      color: "purple",
      icon: HiOutlineRefresh,
    });
  }
  if (card.alerts.length > 0) {
    badges.push({
      text: tr("card.overdue", d),
      color: "yellow",
      icon: HiExclamationCircle,
    });
  }
  const route =
    card.origin || card.destination
      ? `${card.origin ?? "—"} - ${card.destination ?? "—"}`
      : "-";
  const rows: [React.ReactNode, string, string | null][] = [
    [<FaTruck key="t" className={ICON} />, "sheet.truck", card.truck],
    [<FaTruck key="r" className={ICON} />, "sheet.trailer", card.trailer],
    [
      <FaClipboardList key="c" className={ICON} />,
      "sheet.serviceCode",
      card.codes.join(" · ") || null,
    ],
    [
      <FaShield key="s" className={ICON} />,
      "sheet.status",
      statusLabel(card, d),
    ],
    [<FaTruck key="k" className={ICON} />, "sheet.carrier", card.carrier],
    [
      <FaClipboardList key="m" className={ICON} />,
      "sheet.monitor",
      card.monitorKey,
    ],
  ];
  const half = Math.ceil(rows.length / 2);
  const label = ([icon, key, value]: (typeof rows)[number]) => (
    <LoadableLabel
      key={key}
      icon={icon}
      label={trDynamic(key, d)}
      value={value || "-"}
    />
  );
  return (
    <CustomCard
      title={tr("sheet.tripInfo", d)}
      subtitle={tr("sheet.trip", d)}
      badges={badges}
    >
      <div className="flex w-fit flex-col gap-2">
        <div className="flex w-fit flex-wrap gap-x-6">
          <div className="flex w-fit flex-col gap-2">
            {rows.slice(0, half).map(label)}
          </div>
          <div className="flex w-fit flex-col gap-2">
            {rows.slice(half).map(label)}
          </div>
        </div>
        <LoadableLabel
          icon={<FaMapMarkerAlt className={ICON} />}
          label={tr("sheet.route", d)}
          value={route}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-x-4">
          <LoadableLabel
            icon={<FaCalendarAlt className={ICON} />}
            label={tr("sheet.departure", d)}
            value={shortTime(card.departedAt ?? card.plannedStart, lang) ?? "-"}
          />
          <LoadableLabel
            icon={<FaCalendarAlt className={ICON} />}
            label={tr("sheet.arrival", d)}
            value={
              shortTime(card.arrivedAt ?? card.plannedArrival, lang) ?? "-"
            }
          />
        </div>
        {card.cancelReason && (
          <LoadableLabel
            label={tr("sheet.cancelReason", d)}
            value={card.cancelReason}
          />
        )}
      </div>
    </CustomCard>
  );
}

function Bar({
  label,
  done,
  total,
}: Readonly<{ label: string; done: number; total: number }>) {
  const pct = total > 0 ? Math.round((100 * done) / total) : 0;
  return (
    <>
      <span className="text-sm font-light text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full rounded-full bg-gray-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-right text-xs font-medium text-gray-700 dark:text-gray-300">
        {pct}%
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        ({done} / {total})
      </span>
    </>
  );
}

/** How far the trip is: milestones confirmed, stages closed and loads delivered. */
export function Progress({
  sheet,
  d,
}: Readonly<{ sheet: TripSheet; d: I18nRecord }>) {
  const confirmed = sheet.milestones.filter(
    (m) => m.status === "confirmed"
  ).length;
  const closed = sheet.stages.filter((s) => s.status === "completed").length;
  const delivery = sheet.card.delivery;
  return (
    <div className="grid grid-cols-[1fr_5rem_2.5rem_auto] items-center gap-x-2 gap-y-2 p-3">
      <Bar
        label={tr("sheet.milestones", d)}
        done={confirmed}
        total={sheet.milestones.length}
      />
      <Bar
        label={tr("sheet.plan", d)}
        done={closed}
        total={sheet.stages.length}
      />
      {delivery && (
        <Bar
          label={tr("sheet.deliveries.title", d)}
          done={delivery.reached.delivered}
          total={delivery.loads}
        />
      )}
    </div>
  );
}

function DriverData({
  title,
  name,
}: Readonly<{ title: string; name: string }>) {
  return (
    <div className="flex flex-col">
      <h2 className="mb-2 text-sm font-normal text-gray-500 dark:text-gray-400">
        {title}
      </h2>
      <span className="flex w-fit flex-row gap-1 text-sm font-light text-gray-400">
        <FaUser className="inline-block h-4 w-4" />
        <span className="whitespace-normal text-gray-800 dark:text-gray-200">
          {name}
        </span>
      </span>
    </div>
  );
}

export function Drivers({
  card,
  d,
}: Readonly<{ card: BoardCard; d: I18nRecord }>) {
  return (
    <CustomCard title={tr("sheet.drivers", d)} subtitle={null}>
      <div className="flex flex-col gap-4">
        <DriverData
          title={tr("sheet.driver1", d)}
          name={card.driver ?? tr("card.noDriver", d)}
        />
        {card.secondDriver && (
          <DriverData title={tr("sheet.driver2", d)} name={card.secondDriver} />
        )}
        <div className="flex flex-col">
          <h2 className="mb-2 text-sm font-normal text-gray-500 dark:text-gray-400">
            {tr("sheet.carrier", d)}
          </h2>
          <span className="flex w-fit flex-row gap-1 text-sm font-light text-gray-400">
            <FaIdCard className="inline-block h-4 w-4" />
            <span className="whitespace-normal text-gray-800 dark:text-gray-200">
              {card.carrier ?? "-"}
            </span>
          </span>
        </div>
      </div>
    </CustomCard>
  );
}

/** `<milestone>_overdue` reads as the milestone's name; other alerts as they come. */
export function alertText(alert: string, d: I18nRecord) {
  const overdue = /^(.+)_overdue$/.exec(alert);
  return overdue
    ? `${trDynamic(`milestone.${overdue[1]}`, d)} · ${tr("card.overdue", d)}`
    : alert;
}

export function Alerts({
  card,
  d,
}: Readonly<{ card: BoardCard; d: I18nRecord }>) {
  return (
    <CustomCard title={tr("sheet.alerts", d)} subtitle={null}>
      {card.alerts.length === 0 ? (
        <p className="text-sm font-light text-gray-500 dark:text-gray-400">
          {tr("sheet.noAlerts", d)}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-1">
          {card.alerts.map((a) => (
            <li
              key={a}
              className="flex items-center gap-2 rounded-md border border-gray-200 px-1.5 py-1 dark:border-gray-700"
            >
              <HiExclamationCircle className="h-5 w-5 shrink-0 text-yellow-500" />
              <span className="min-w-0 flex-1 truncate text-sm font-light text-gray-600 dark:text-gray-300">
                {alertText(a, d)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </CustomCard>
  );
}
