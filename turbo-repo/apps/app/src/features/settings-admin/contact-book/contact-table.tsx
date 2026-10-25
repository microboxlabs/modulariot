"use client";

import { useState, type ComponentType, type SVGProps } from "react";
import { Dropdown, DropdownItem } from "flowbite-react";
import {
  HiCheck,
  HiOutlineClipboardCopy,
  HiDotsVertical,
  HiOutlinePencil,
  HiOutlineTrash,
} from "react-icons/hi";
import { Phone } from "flowbite-react-icons/solid";
import { SiGooglemeet } from "react-icons/si";
import {
  BrandLogo,
  type LogoKeyline,
} from "@/features/common/components/brand-logo";
import CatalogTable from "@/features/common/components/catalog-table";
import { channelLogo } from "@/features/conversations/channel-icon";
import InitialIdentifier from "@/features/common/components/user-related/initial-identifier";
import { ShowNotification } from "@/features/notifications/notification";
import {
  ALL_CALL_METHODS,
  type CallMethod,
} from "@/features/symptoms/components/map-view/prototype/call-center/call-method";
import { formatChileanPhone } from "@/features/symptoms/components/map-view/prototype/call-center/format-chilean-phone";
import type { BookContact } from "./store";
import { BADGE_CLASS } from "./contact-badges-section";
import HoverTooltip from "./hover-tooltip";
import type { ContactBadge } from "./taxonomy-store";

/** The call methods and the email the communication rules write to. */
type ContactMethod = CallMethod | "email";

/** The channel logos of Comunicaciones, and Flowbite's phone; Meet has no Flowbite mark. WhatsApp's is round. */
const METHOD_LOGOS: Record<
  ContactMethod,
  {
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    keyline: LogoKeyline;
  }
> = {
  phone: { icon: Phone, keyline: "square" },
  whatsapp: { icon: channelLogo("whatsapp"), keyline: "circle" },
  meet: { icon: SiGooglemeet, keyline: "square" },
  teams: { icon: channelLogo("teams"), keyline: "square" },
  email: { icon: channelLogo("email"), keyline: "square" },
};

/** A method's logo on the credentials' keylines: every mark in the same box, a round one drawn larger. */
function MethodLogo({
  method,
  label,
  size,
}: Readonly<{ method: ContactMethod; label: string; size: number }>) {
  const { icon, keyline } = METHOD_LOGOS[method];
  // The button or tooltip around it already names the method.
  return (
    <span aria-hidden className="inline-flex">
      <BrandLogo icon={icon} keyline={keyline} alt={label} size={size} />
    </span>
  );
}

const TABLE_METHODS: ContactMethod[] = [...ALL_CALL_METHODS, "email"];

export interface ContactTableLabels {
  columns: {
    name: string;
    role: string;
    company: string;
    badges: string;
    methods: string;
    actions: string;
  };
  methodLabels: Record<ContactMethod, string>;
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
  method: ContactMethod
): string {
  if (method === "email") return contact.email ?? "";
  const value = contact.channels?.[method];
  if (value) return value;
  if (!contact.methods.includes(method)) return "";
  return method === "phone" || method === "whatsapp" ? contact.phone : "";
}

function displayValue(method: ContactMethod, value: string): string {
  return method === "phone" || method === "whatsapp"
    ? formatChileanPhone(value)
    : value;
}

const CONNECTED_ICON_CLASS =
  "flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700";
const DISCONNECTED_ICON_CLASS =
  "flex h-7 w-7 items-center justify-center rounded-full border border-transparent bg-gray-100 text-gray-400 dark:bg-gray-700/60 dark:text-gray-500";

function MethodTooltipContent({
  method,
  labels,
  value,
}: Readonly<{
  method: ContactMethod;
  labels: ContactTableLabels;
  value?: string;
}>) {
  return (
    <div className="flex flex-col gap-1.5 py-1">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
          <MethodLogo
            method={method}
            label={labels.methodLabels[method]}
            size={20}
          />
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
  readonly method: ContactMethod;
  readonly labels: ContactTableLabels;
}

/** A method the contact has no address for: shown muted, hover explains
 *  it isn't connected, nothing to copy. */
function DisconnectedMethodIcon({ method, labels }: Readonly<MethodIconProps>) {
  const label = `${labels.methodLabels[method]}: ${labels.notConnected}`;
  return (
    <HoverTooltip
      content={<MethodTooltipContent method={method} labels={labels} />}
    >
      <span aria-label={label} role="img" className={DISCONNECTED_ICON_CLASS}>
        <span className="opacity-50">
          <MethodLogo method={method} label={label} size={20} />
        </span>
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
          <MethodLogo
            method={method}
            label={labels.methodLabels[method]}
            size={20}
          />
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
      {TABLE_METHODS.map((m) => {
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
  const description = contact.description || contact.rut;
  const badges = (contact.badgeIds ?? []).flatMap((id) => {
    const badge = badgesById.get(id);
    return badge ? [badge] : [];
  });

  return (
    <tr className="border-t border-gray-100 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50">
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
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
        {contact.role || EMPTY_CELL}
      </td>
      <td className="px-4 py-3">
        {contact.company || contact.companyRut ? (
          <div className="min-w-0">
            <p className="truncate text-gray-700 dark:text-gray-300">
              {contact.company || EMPTY_CELL}
            </p>
            {contact.companyRut && (
              <p className="truncate font-mono text-xs text-gray-500 dark:text-gray-400">
                {contact.companyRut}
              </p>
            )}
          </div>
        ) : (
          EMPTY_CELL
        )}
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

/** Settings › Libreta de contactos as a list, in the settings catalogs'
 *  table: initial, name (description underneath), role, company and its
 *  RUT, badges, contact methods with the email, and a row menu. */
export default function ContactTable({
  contacts,
  badges,
  labels,
  onEdit,
  onRemove,
}: Readonly<{
  contacts: readonly BookContact[];
  badges: readonly ContactBadge[];
  labels: ContactTableLabels;
  onEdit: (contact: BookContact) => void;
  onRemove: (id: string) => void;
}>) {
  const badgesById = new Map(badges.map((b) => [b.id, b]));
  return (
    <CatalogTable
      columns={[
        labels.columns.name,
        labels.columns.role,
        labels.columns.company,
        labels.columns.badges,
        labels.columns.methods,
        "",
      ]}
    >
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
    </CatalogTable>
  );
}

/** A contact laid out like a rule or symptom card: initial, name and role,
 *  company, badges, and its contact methods at the foot. The card opens the
 *  contact; the menu edits or removes it. */
export function ContactCard({
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
  const badges = (contact.badgeIds ?? []).flatMap((id) => {
    const badge = badgesById.get(id);
    return badge ? [badge] : [];
  });
  const company = [contact.company, contact.companyRut]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-white text-left transition hover:border-blue-400 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500">
      <div className="flex w-full items-start gap-3 px-4 pt-4">
        <InitialIdentifier name={contact.name || "?"} size={44} />
        <button
          type="button"
          className="min-w-0 flex-1 text-left focus:outline-none"
          onClick={() => onEdit(contact)}
        >
          <div className="truncate font-semibold text-gray-900 hover:underline dark:text-white">
            {contact.name}
          </div>
          <div className="truncate text-xs text-gray-500 dark:text-gray-400">
            {contact.role || contact.description || EMPTY_CELL}
          </div>
        </button>
        <RowMenu
          labels={labels}
          onEdit={() => onEdit(contact)}
          onRemove={() => onRemove(contact.id)}
        />
      </div>
      <p className="mt-3 h-4 truncate px-4 text-xs text-gray-600 dark:text-gray-300">
        {company}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 px-4 text-xs">
        {badges.map((b) => (
          <span key={b.id} className={BADGE_CLASS}>
            {b.name}
          </span>
        ))}
      </div>
      {/* Keeps the footers of a row of cards on one line. */}
      <div className="min-h-3 flex-1" />
      <div className="flex w-full items-center border-t border-gray-100 px-4 py-2.5 dark:border-gray-700/60">
        <ContactMethods contact={contact} labels={labels} />
      </div>
    </div>
  );
}
