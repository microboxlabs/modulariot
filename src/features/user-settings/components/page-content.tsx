"use client";

//import { useState } from "react";

import { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
//import { useRouter, useSearchParams } from "next/navigation";
import { ClientBreadcrumb } from "@/features/common/components/Breadcrumb/ClientBreadcrumb";
import { HiClipboardList } from "react-icons/hi";
import SymptomsCard from "./symptoms";

export default function PageContent({ dict }: PropsWithI18nDict) {
  /* const router = useRouter();
  const searchParams = useSearchParams();

  const [page, setPage] = useState(1);
  const pageSize = 100; */
  console.log(dict);

  return (
    <div className="w-full h-full flex flex-col overflow-auto">
      <div className="inline-block align-middle relative">
        <div className="p-5 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 dark:text-white w-full">
          <ClientBreadcrumb
            path={["breadcrumb.user", "breadcrumb.settings"]}
            rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
            dict={dict}
          />
        </div>
        <div className="grid grid-cols-1 px-4 pt-6 xl:grid-cols-2 xl:gap-2 dark:bg-gray-900">
          <SymptomsCard dict={dict} />
        </div>
      </div>
      <div className="h-screen w-full overflow-auto"></div>
    </div>
  );
}
