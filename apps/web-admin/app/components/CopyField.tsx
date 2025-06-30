"use client";

import { useState } from "react";
import { TextInput, Button } from "flowbite-react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface CopyFieldProps {
  label: string;
  value: string;
  className?: string;
}

export default function CopyField({ label, value, className = "" }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <div className="flex">
        <TextInput
          type="text"
          value={value}
          readOnly
          className="flex-1 rounded-r-none"
        />
        <Button
          onClick={handleCopy}
          color="gray"
          className="rounded-l-none border-l-0"
          size="sm"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}