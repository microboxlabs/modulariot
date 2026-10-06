"use client";

import { useEffect, useState, type FocusEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Dropdown, DropdownItem } from "flowbite-react";
import {
  HiCheck,
  HiOutlineClipboardCopy,
  HiDotsVertical,
  HiOutlinePencil,
  HiOutlineTrash,
} from "react-icons/hi";
import InitialIdentifier from "@/features/common/components/user-related/initial-identifier";
import { ShowNotification } from "@/features/notifications/notification";
import {
  ALL_CALL_METHODS,
  CALL_METHOD_ICONS,
  type CallMethod,
} from "@/features/symptoms/components/map-view/prototype/call-center/call-method";
import { formatChileanPhone } from "@/features/symptoms/components/map-view/prototype/call-center/format-chilean-phone";
import type { BookContact } from "./store";
import { BADGE_CLASS } from "./contact-badges-section";
import type { ContactBadge } from "./taxonomy-store";

export interface ContactTableLabels {
  columns: {
    name: string;
    badges: string;
    methods: string;
    actions: string;
  };
  methodLabels: Record<CallMethod, string>;
  copied: string;
  notConnected: string;
  clickToCopy: string;
  edit: string;
  remove: string;
}

/** The address a contact is reached on for `method`, or "" when that method
 *  isn't configured. Contacts saved before `channels` existed fall back to
 *  the legacy `phone` for phone/WhatsApp. */
export function contactMethodValue(
  contact: BookContact,
  method: CallMethod
): string {
  const value = contact.channels?.[method];
  if (value) return value;
  if (!contact.methods.includes(method)) return "";
  return method === "phone" || method === "whatsapp" ? contact.phone : "";
}

function displayValue(method: CallMethod, value: string): string {
  return method === "phone" || method === "whatsapp"
    ? formatChileanPhone(value)
    : value;
}

const CONNECTED_ICON_CLASS =
  "flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700";
const DISCONNECTED_ICON_CLASS =
  "flex h-7 w-7 items-center justify-center rounded-full border border-transparent bg-gray-100 text-gray-400 dark:bg-gray-700/60 dark:text-gray-500";

/** Card-style tooltip: light surface, soft border and shadow, no arrow.
 *  `pointer-events-none` so it can never be hovered itself. */
const METHOD_TOOLTIP_CLASS =
  "pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-lg shadow-gray-900/10 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-black/40";
const TOOLTIP_GAP_PX = 8;

/**
 * Shows `content` above its child ONLY while the pointer is over the child
 * (or it has keyboard focus). Unlike Flowbite's Tooltip, it doesn't stay open
 * while hovering the tooltip itself or after a click leaves the button
 * focused. Rendered in a portal with fixed positioning so the table's
 * overflow container can't clip it; any scroll closes it.
 */
function HoverTooltip({
  content,
  children,
}: Readonly<{ content: ReactNode; children: ReactNode }>) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!anchor) return;
    const close = () => setAnchor(null);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [anchor]);

  const showFor = (el: HTMLElement) => setAnchor(el.getBoundingClientRect());
  const hide = () => setAnchor(null);
  const handleFocus = (e: FocusEvent<HTMLSpanElement>) => {
    if (e.target.matches(":focus-visible")) showFor(e.currentTarget);
  };

  return (
    <>
      <span
        className="inline-flex"
        onMouseEnter={(e) => showFor(e.currentTarget)}
        onMouseLeave={hide}
        onFocus={handleFocus}
        onBlur={hide}
      >
        {children}
      </span>
      {anchor &&
        createPortal(
          <div
            role="tooltip"
            className={METHOD_TOOLTIP_CLASS}
            style={{
              left: anchor.left + anchor.width / 2,
              top: anchor.top - TOOLTIP_GAP_PX,
            }}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}

function MethodTooltipContent({
  method,
  labels,
  value,
}: Readonly<{
  method: CallMethod;
  labels: ContactTableLabels;
  value?: string;
}>) {
  const Icon = CALL_METHOD_ICONS[method];
  return (
    <div className="flex flex-col gap-1.5 py-1">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
          <Icon className="h-4 w-4" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="whitespace-nowrap text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {labels.methodLabels[method]}
          </span>
          {value ? (
            <span className="truncate font-semibold text-gray-900 dark:text-white">
              {value}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400 dark:text-gray-500">
              <span className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
              {labels.notConnected}
            </span>
          )}
        </div>
      </div>
      {value && (
        <div className="flex items-center gap-1.5 border-t border-gray-100 pt-1.5 text-[11px] font-medium text-gray-400 dark:border-gray-700 dark:text-gray-500">
          <HiOutlineClipboardCopy className="h-3.5 w-3.5" />
          {labels.clickToCopy}
        </div>
      )}
    </div>
  );
}

interface MethodIconProps {
  readonly method: CallMethod;
  readonly labels: ContactTableLabels;
}

/** A method the contact has no address for: shown muted, hover explains
 *  it isn't connected, nothing to copy. */
function DisconnectedMethodIcon({ method, labels }: Readonly<MethodIconProps>) {
  const Icon = CALL_METHOD_ICONS[method];
  const label = `${labels.methodLabels[method]}: ${labels.notConnected}`;
  return (
    <HoverTooltip
      content={<MethodTooltipContent method={method} labels={labels} />}
    >
      <span aria-label={label} role="img" className={DISCONNECTED_ICON_CLASS}>
        <Icon className="h-3.5 w-3.5" />
      </span>
    </HoverTooltip>
  );
}

/** A connected method: highlighted, hover shows the method and its address,
 *  click copies the address. */
function ConnectedMethodIcon({
  method,
  value,
  labels,
}: Readonly<MethodIconProps & { value: string }>) {
  const [copied, setCopied] = useState(false);
  const Icon = CALL_METHOD_ICONS[method];
  const shown = displayValue(method, value);

  const handleCopy = () => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      ShowNotification({ type: "success", message: labels.copied });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <HoverTooltip
      content={
        <MethodTooltipContent method={method} labels={labels} value={shown} />
      }
    >
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`${labels.methodLabels[method]}: ${shown}`}
        className={CONNECTED_ICON_CLASS}
      >
        {copied ? (
          <HiCheck className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
        ) : (
          <Icon className="h-3.5 w-3.5" />
        )}
      </button>
    </HoverTooltip>
  );
}

/** Every method, in a fixed order, so rows line up: connected ones
 *  highlighted and copyable, the rest muted. */
function ContactMethods({
  contact,
  labels,
}: Readonly<{ contact: BookContact; labels: ContactTableLabels }>) {
  return (
    <div className="flex items-center gap-1.5">
      {ALL_CALL_METHODS.map((m) => {
        const value = contactMethodValue(contact, m);
        if (value) {
          return (
            <ConnectedMethodIcon
              key={m}
              method={m}
              value={value}
              labels={labels}
            />
          );
        }
        return <DisconnectedMethodIcon key={m} method={m} labels={labels} />;
      })}
    </div>
  );
}

/** Softer than Flowbite's default menu: rounded card with a light shadow,
 *  items that ease their hover colour, labels on one line. */
const ROW_MENU_THEME = {
  content: "p-0 focus:outline-none",
  floating: {
    base: "z-10 w-fit min-w-40 overflow-hidden rounded-xl border border-gray-200 shadow-lg shadow-gray-900/10 focus:outline-none dark:border-gray-600 dark:shadow-black/40",
    content: "p-0 text-sm text-gray-700 dark:text-gray-200",
    item: {
      base: "flex w-full cursor-pointer items-center justify-start whitespace-nowrap px-3 py-2 text-sm text-gray-700 transition-colors duration-150 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none dark:text-gray-200 dark:hover:bg-gray-600 dark:hover:text-white dark:focus:bg-gray-600 dark:focus:text-white",
    },
  },
};

function RowMenu({
  labels,
  onEdit,
  onRemove,
}: Readonly<{
  labels: ContactTableLabels;
  onEdit: () => void;
  onRemove: () => void;
}>) {
  return (
    <Dropdown
      inline
      arrowIcon={false}
      label=""
      placement="bottom-end"
      theme={ROW_MENU_THEME}
      renderTrigger={() => (
        <button
          type="button"
          aria-label={labels.columns.actions}
          className="cursor-pointer p-1 text-gray-400 transition-colors duration-200 hover:text-gray-900 focus:outline-none focus-visible:text-gray-900 dark:text-gray-500 dark:hover:text-white dark:focus-visible:text-white"
        >
          <HiDotsVertical className="h-4 w-4" />
        </button>
      )}
    >
      <DropdownItem icon={HiOutlinePencil} onClick={onEdit}>
        {labels.edit}
      </DropdownItem>
      <DropdownItem
        icon={HiOutlineTrash}
        onClick={onRemove}
        className="text-red-500 hover:bg-red-50 focus:bg-red-50 dark:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-500 dark:focus:bg-red-500/10 dark:focus:text-red-500"
      >
        {labels.remove}
      </DropdownItem>
    </Dropdown>
  );
}

const EMPTY_CELL = <span className="text-gray-300 dark:text-gray-600">—</span>;

function ContactTableRow({
  contact,
  labels,
  onEdit,
  onRemove,
  badgesById,
}: Readonly<{
  contact: BookContact;
  labels: ContactTableLabels;
  onEdit: (contact: BookContact) => void;
  onRemove: (id: string) => void;
  badgesById: ReadonlyMap<string, ContactBadge>;
}>) {
  const description = contact.description || contact.role || contact.rut;
  const badges = (contact.badgeIds ?? []).flatMap((id) => {
    const badge = badgesById.get(id);
    return badge ? [badge] : [];
  });

  return (
    <tr className="border-b border-gray-200 bg-white last:border-b-0 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700/50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <InitialIdentifier name={contact.name || "?"} size={32} />
          <div className="min-w-0">
            <p className="truncate font-medium text-gray-900 dark:text-white">
              {contact.name}
            </p>
            {description && (
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {description}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {badges.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {badges.map((b) => (
              <span key={b.id} className={BADGE_CLASS}>
                {b.name}
              </span>
            ))}
          </div>
        ) : (
          EMPTY_CELL
        )}
      </td>
      <td className="px-4 py-3">
        <ContactMethods contact={contact} labels={labels} />
      </td>
      <td className="px-2 py-3 text-right">
        <RowMenu
          labels={labels}
          onEdit={() => onEdit(contact)}
          onRemove={() => onRemove(contact.id)}
        />
      </td>
    </tr>
  );
}

/** Settings › Libreta de contactos listing: one row per contact with its
 *  initial, name (description underneath), badges, contact methods and a
 *  row menu. */
export default function ContactTable({
  contacts,
  badges,
  labels,
  onEdit,
  onRemove,
  className = "",
  footer,
}: Readonly<{
  contacts: readonly BookContact[];
  badges: readonly ContactBadge[];
  labels: ContactTableLabels;
  onEdit: (contact: BookContact) => void;
  onRemove: (id: string) => void;
  /** Extra classes for the scroll container (e.g. to fill its parent). */
  className?: string;
  /** Rendered after the table, inside the scroll container. */
  footer?: ReactNode;
}>) {
  const badgesById = new Map(badges.map((b) => [b.id, b]));
  const headerClass =
    "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400";

  return (
    <div
      className={`overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}
    >
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
          <tr>
            <th className={headerClass}>{labels.columns.name}</th>
            <th className={headerClass}>{labels.columns.badges}</th>
            <th className={`${headerClass} text-left w-50`}>
              {labels.columns.methods}
            </th>
            <th className="w-12 px-2 py-3">
              <span className="sr-only">{labels.columns.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <ContactTableRow
              key={contact.id}
              contact={contact}
              labels={labels}
              onEdit={onEdit}
              onRemove={onRemove}
              badgesById={badgesById}
            />
          ))}
        </tbody>
      </table>
      {footer}
    </div>
  );
}
