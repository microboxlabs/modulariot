"use client";

import { useState } from "react";
import { Button, TextInput } from "flowbite-react";
import { HiCheck, HiClipboardCopy, HiOutlineMail } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { MailDelivery } from "./team.types";

export interface InviteLink {
  email: string;
  url: string;
  delivery: MailDelivery | null;
}

interface InviteLinkRowProps {
  readonly link: InviteLink;
  readonly d: I18nRecord;
}

function InviteLinkRow({ link, d }: InviteLinkRowProps) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(link.url);
    setCopied(true);
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-gray-900 dark:text-white">
        {link.email}
      </span>
      <DeliveryNote delivery={link.delivery} d={d} />
      <div className="flex gap-2">
        <TextInput
          readOnly
          value={link.url}
          className="flex-1"
          sizing="sm"
          aria-label={link.email}
        />
        <Button size="sm" color="alternative" onClick={copy}>
          {copied ? (
            <HiCheck className="mr-1 h-4 w-4" />
          ) : (
            <HiClipboardCopy className="mr-1 h-4 w-4" />
          )}
          {copied ? tr("copied", d) : tr("copy", d)}
        </Button>
      </div>
    </div>
  );
}

interface DeliveryNoteProps {
  readonly delivery: MailDelivery | null;
  readonly d: I18nRecord;
}

/** Whether the link went out by email, and why not when it did not. */
function DeliveryNote({ delivery, d }: DeliveryNoteProps) {
  if (delivery?.status === "SENT") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
        <HiOutlineMail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        {tr("emailSent", d)}
      </span>
    );
  }
  if (delivery?.status === "FAILED") {
    return (
      <span className="text-xs text-gray-600 dark:text-gray-300">
        {tr("emailFailed", d, { reason: delivery.detail ?? "" })}
      </span>
    );
  }
  if (delivery?.status === "NOT_CONFIGURED") {
    return (
      <span className="text-xs text-gray-600 dark:text-gray-300">
        {tr("emailNotConfigured", d, { reason: delivery.detail ?? "" })}
      </span>
    );
  }
  return null;
}

interface InviteLinksProps {
  readonly links: InviteLink[];
  readonly d: I18nRecord;
}

/** The invitation links, shown once after creating or resending them. */
export function InviteLinks({ links, d }: InviteLinksProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {tr("linksBody", d)}
      </p>
      {links.map((link) => (
        <InviteLinkRow key={link.url} link={link} d={d} />
      ))}
    </div>
  );
}
