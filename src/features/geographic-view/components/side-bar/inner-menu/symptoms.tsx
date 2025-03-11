import { Label } from "flowbite-react";
import TableComponent from "@/features/symptoms/components/table-component";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function Symptoms({ dict }: { dict: I18nRecord }) {
  return (
    <div className="w-full flex flex-col gap-4">
      <Label className="w-full flex text-left text-lg">
        {(dict.symptoms as I18nRecord).symptoms as string}
      </Label>
      <div className="z-50 h-full flex flex-col gap-2 overflow-visible">
        <TableComponent
          dict={dict}
          currentPage={1}
          pageSize={100}
          searchTerm=""
          setCurrentPage={() => {}}
          compact={true}
        />
      </div>
    </div>
  );
}
