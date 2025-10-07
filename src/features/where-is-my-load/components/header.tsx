"use client";

import { Button } from "flowbite-react";
import { useSearchParams } from "next/navigation";
import React from "react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import Link from "next/link";
import { tr } from "@/features/i18n/tr.service";

export default function TimelineHeader({ dict }: { dict: I18nRecord }) {
  const searchParams = useSearchParams();
  const loadId = searchParams.get("loadId");

  if (loadId === null) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-2 portrait:gap-2 flex flex-wrap items-center justify-between border-b border-gray-300 dark:border-gray-700">
      <h1 className="text-xl font-light text-gray-900 dark:text-gray-100 p-2">
        N°{loadId}
      </h1>
      <Button
        color="blue"
        className="h-10 transition-all duration-300 hover:border-gray-800 dark:hover:border-gray-300 z-10 gap-2 w-fit p-0"
        as={Link}
        href=""
      >
        <div className="flex flex-row gap-2 items-center">
          <p className="text-sm text-gray-100 lg:block hidden whitespace-nowrap">
            {tr("bento.go_to_bento", dict)}
          </p>
        </div>
      </Button>
    </div>
  );
}
