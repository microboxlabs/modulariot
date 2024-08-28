"use client";
import { Card } from "flowbite-react";
import { useEffect } from "react";
import { SovosStartVerificationCardProps } from "./sovos-start-verification-card.types";
import { validateRut } from "@/features/sovos-fingerprint/services/autentia";

export default function SovosStartVerificationCard({
  msg,
  pluginReady,
}: SovosStartVerificationCardProps) {
  useEffect(() => {
    console.log("pluginReady", pluginReady);
    if (!pluginReady) return;
    validateRut("24952044-6")
      .then((result) => {
        console.log("result", result);
      })
      .catch((error) => {
        console.log("error", error);
      });
  }, [pluginReady]);

  return (
    <Card>
      <div className="flex flex-col min-w-96 items-center justify-center w-96">
        <div className="h-40	w-40"></div>
        <h5 className="text-xl font-medium tracking-tight text-gray-900 dark:text-white mt-9">
          {msg!.title as string}
        </h5>
        <div className="text-gray-900">{msg!.subtitle as string}</div>
        <div className="text-center text-justified p-4">
          {msg!.description as string}
        </div>
      </div>
    </Card>
  );
}
