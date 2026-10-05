"use client";

import { useState } from "react";
import { Alert, Button, TextInput } from "flowbite-react";
import { HiCheck, HiClipboardCopy, HiExclamation } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

interface SecretOnceProps {
  readonly secret: string;
  readonly d: I18nRecord;
}

/** A new API key's secret, shown once right after it is created. */
export function SecretOnce({ secret, d }: SecretOnceProps) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
  };
  return (
    <div className="flex flex-col gap-3">
      <Alert color="warning" icon={HiExclamation}>
        {tr("secretOnce", d)}
      </Alert>
      <div className="flex gap-2">
        <TextInput
          readOnly
          value={secret}
          className="flex-1 font-mono"
          sizing="sm"
          aria-label={tr("secret", d)}
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
