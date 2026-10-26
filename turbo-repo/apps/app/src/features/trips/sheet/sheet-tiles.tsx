"use client";

import {
  FaCalendarAlt,
  FaCheck,
  FaClipboardList,
  FaCog,
  FaIdCard,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaTruck,
  FaUser,
} from "react-icons/fa";
import { FaShield } from "react-icons/fa6";
import {
  HiExclamation,
  HiExclamationCircle,
  HiOutlineHome,
  HiOutlineRefresh,
} from "react-icons/hi";
import CustomCard, {
  type InformationBadge,
} from "@/features/common/components/custom-card/custom-card";
import LoadableLabel from "@/features/common/components/loadable-label/loadable-label";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { BoardCard } from "../board/board-api";
import { shortTime, statusLabel } from "../board/trip-card";
import type {
  DriverValidation,
  SheetDriver,
  TripDetails,
  TripSheet,
} from "./sheet-api";

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

const OWN_SITES = new Set(["plant", "port", "distribution_center"]);

/** Whether the trip leaves from one of the operator's sites or picks the cargo up at a customer's address. */
export function tripType(originType: string | null | undefined) {
  if (originType && OWN_SITES.has(originType)) return "own";
  if (originType === "customer") return "pickup";
  return "unknown";
}

/** The distinct values, joined; null when there is none. */
function joined(values: (string | null)[]) {
  const distinct = [...new Set(values.filter(Boolean))];
  return distinct.length > 0 ? distinct.join(" · ") : null;
}

export function TripInfo({
  card,
  details,
  d,
  lang,
}: Readonly<{
  card: BoardCard;
  details: TripDetails | null;
  d: I18nRecord;
  lang: string;
}>) {
  const type = tripType(details?.originType);
  const badges: InformationBadge[] = [
    {
      text: trDynamic(`sheet.tripType.${type}`, d),
      color: type === "pickup" ? "indigo" : "gray",
      icon: HiOutlineHome,
    },
  ];
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
    [
      <FaCog key="o" className={ICON} />,
      "sheet.serviceType",
      joined(details?.orders.map((o) => o.orderType) ?? []),
    ],
    [
      <FaClipboardList key="m" className={ICON} />,
      "sheet.monitor",
      card.monitorKey,
    ],
    [
      <FaTruck key="k" className={ICON} />,
      "sheet.carrier",
      details?.carrier?.name ?? card.carrier,
    ],
    [
      <FaIdCard key="kr" className={ICON} />,
      "sheet.carrierRut",
      details?.carrier?.rut ?? null,
    ],
    [
      <FaIdCard key="kc" className={ICON} />,
      "sheet.carrierCode",
      details?.carrier?.code ?? null,
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
    <CustomCard title={tr("sheet.tripInfo", d)} subtitle={null} badges={badges}>
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

const NO_DRIVER: SheetDriver = {
  name: null,
  rut: null,
  phone: null,
  validations: [],
};

const PASSED = new Set(["PASSED", "OK", "VALID", "ACCREDITED", "APPROVED"]);

/** A check that passed shows a gray tick; any other value, a yellow mark. */
export function validationPassed(v: DriverValidation) {
  return PASSED.has((v.value ?? "").toUpperCase());
}

function ValidationRow({
  v,
  lang,
}: Readonly<{ v: DriverValidation; lang: string }>) {
  const passed = validationPassed(v);
  const until = shortTime(v.validUntil, lang);
  const title = [v.value, v.source, until].filter(Boolean).join(" · ");
  return (
    <li className="flex items-center gap-2" title={title}>
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${passed ? "bg-gray-400" : "bg-yellow-400"}`}
      >
        {passed ? (
          <FaCheck className="h-3 w-3" />
        ) : (
          <HiExclamation className="h-3.5 w-3.5" />
        )}
      </span>
      <span className="text-sm text-gray-800 dark:text-gray-200">{v.key}</span>
    </li>
  );
}

/** One driver; a missing value shows as "-" so both slots keep the same height. */
function DriverData({
  title,
  driver,
  d,
  lang,
}: Readonly<{
  title: string;
  driver: SheetDriver;
  d: I18nRecord;
  lang: string;
}>) {
  const rows: [string, React.ReactNode, string | null][] = [
    ["name", <FaUser key="name" className="h-4 w-4" />, driver.name],
    ["phone", <FaPhoneAlt key="phone" className="h-4 w-4" />, driver.phone],
    ["rut", <FaIdCard key="rut" className="h-4 w-4" />, driver.rut],
  ];
  return (
    <div className="flex flex-col">
      <h2 className="mb-2 text-sm font-normal text-gray-500 dark:text-gray-400">
        {title}
      </h2>
      <div className="flex flex-col gap-2">
        {rows.map(([key, icon, value]) => (
          <span
            key={key}
            className="flex w-fit flex-row gap-1 text-sm font-light text-gray-400"
          >
            {icon}
            <span className="whitespace-normal text-gray-800 dark:text-gray-200">
              {value || "-"}
            </span>
          </span>
        ))}
      </div>
      {driver.validations.length > 0 && (
        <>
          <h3 className="mt-3 mb-2 text-sm font-normal text-gray-500 dark:text-gray-400">
            {tr("sheet.validations", d)}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {driver.validations.map((v) => (
              <ValidationRow key={`${v.type}:${v.key}`} v={v} lang={lang} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Both driver slots, from the fleet when known, else the names on the card. */
export function sheetDrivers(card: BoardCard, details: TripDetails | null) {
  const known = details?.drivers ?? [];
  const names = [card.driver, card.secondDriver];
  return [0, 1].map(
    (i) => known[i] ?? (names[i] ? { ...NO_DRIVER, name: names[i] } : NO_DRIVER)
  );
}

export function Drivers({
  card,
  details,
  d,
  lang,
}: Readonly<{
  card: BoardCard;
  details: TripDetails | null;
  d: I18nRecord;
  lang: string;
}>) {
  const [first, second] = sheetDrivers(card, details);
  return (
    <CustomCard title={tr("sheet.drivers", d)} subtitle={null}>
      <div className="flex flex-col gap-4">
        <DriverData
          title={tr("sheet.driver1", d)}
          driver={first}
          d={d}
          lang={lang}
        />
        <DriverData
          title={tr("sheet.driver2", d)}
          driver={second}
          d={d}
          lang={lang}
        />
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
