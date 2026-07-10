"use client";

import { motion } from "motion/react";
import { HiOutlineEnvelope } from "react-icons/hi2";
import type { RegisterFormMessages } from "./form-sign-in.types";

// Classic Gmail palette, used as a blurred backdrop on this last screen —
// the only step with no form fields, so it needed something to fill the
// space besides a line of text. Each blob just fades in from invisible.
const BLOBS = [
  { color: "#FBBC05", className: "-right-8 -bottom-12 h-32 w-32", delay: 0 },
  { color: "#EA4335", className: "-left-10 -top-16 h-40 w-40", delay: 0.1 },
  { color: "#4285F4", className: "-right-12 -top-10 h-44 w-44", delay: 0.2 },
  { color: "#34A853", className: "-left-8 -bottom-16 h-36 w-36", delay: 0.3 },
] as const;

const BLOB_OPACITY = 0.22;

export default function RegisterStepVerification({
  msg,
  email,
}: Readonly<{
  msg: RegisterFormMessages;
  /** The email typed in on the profile step, interpolated into the message below */
  email?: string;
}>) {
  const [before, after] = msg.verificationMessage.split("{email}");

  return (
    <div className="relative flex flex-col items-center gap-4 overflow-hidden rounded-2xl bg-gray-50 px-6 py-12 text-center dark:bg-gray-900/40">
      <div className="pointer-events-none absolute inset-0">
        {BLOBS.map((blob) => (
          <motion.span
            key={blob.color}
            className={`absolute rounded-full blur-3xl ${blob.className}`}
            style={{ backgroundColor: blob.color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: BLOB_OPACITY }}
            transition={{ duration: 1, ease: "easeInOut", delay: blob.delay }}
          />
        ))}
      </div>

      <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white text-blue-700 shadow-sm dark:bg-gray-800 dark:text-blue-400">
        <HiOutlineEnvelope className="h-7 w-7" />
      </span>
      <p className="relative max-w-sm text-sm text-gray-600 dark:text-gray-300">
        {before}
        {email && (
          <span className="font-medium text-gray-900 dark:text-white">
            {email}
          </span>
        )}
        {after}
      </p>
    </div>
  );
}
