"use client";

import { useState } from "react";
import { Button, TextInput } from "flowbite-react";
import { HiCheck, HiClipboardCopy } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

export interface InviteLink {
  email: string;
  url: string;
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
