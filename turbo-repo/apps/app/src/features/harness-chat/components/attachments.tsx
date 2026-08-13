"use client";

import {
  AttachmentPrimitive,
  type Attachment,
  type CompleteAttachment,
} from "@assistant-ui/react";
import { LuFile, LuX } from "react-icons/lu";
import { useEffect, useState } from "react";

export function SentAttachment({ attachment }: Readonly<{ attachment: CompleteAttachment }>) {
  const part = attachment.content[0];
  const name = attachment.name;

  if (attachment.type === "image" && part?.type === "image") {
    return (
      // Data-URL attachment content — next/image doesn't optimize these anyway.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={part.image}
        alt={name}
        className="max-h-48 max-w-55 rounded-lg border border-gray-200 object-cover dark:border-gray-700"
      />
    );
  }

  const href = part?.type === "file" ? part.data : undefined;

  return (
    <a
      href={href}
      download={name}
      target="_blank"
      rel="noreferrer"
      className="flex max-w-[85%] items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
    >
      <LuFile className="h-3 w-3 shrink-0" />
      <span className="truncate">{name}</span>
    </a>
  );
}

export function ComposerAttachmentPreview({ attachment }: Readonly<{ attachment: Attachment }>) {
  if (attachment.type === "image" && attachment.file) {
    return <ComposerImagePreview file={attachment.file} name={attachment.name} />;
  }

  return (
    <AttachmentPrimitive.Root className="flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
      <LuFile className="h-3 w-3 shrink-0" />
      <span className="max-w-40 truncate">
        <AttachmentPrimitive.Name />
      </span>
      <AttachmentPrimitive.Remove className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-600 dark:hover:text-gray-100">
        <LuX className="h-3 w-3" />
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  );
}

function ComposerImagePreview({ file, name }: Readonly<{ file: File; name: string }>) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <AttachmentPrimitive.Root className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-gray-200 dark:border-gray-600">
      {url && (
        // Local object URL for the not-yet-sent file — next/image can't handle these.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full object-cover" />
      )}
      <AttachmentPrimitive.Remove
        aria-label="Remove image"
        className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
      >
        <LuX className="h-2.5 w-2.5" />
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  );
}
