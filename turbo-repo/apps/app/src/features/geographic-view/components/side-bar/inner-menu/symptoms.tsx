import { Label } from "flowbite-react";
import TableComponent from "@/features/symptoms/components/table-component";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useOperatorPagination } from "@/features/symptoms/hooks/use-operator-filter";

export default function Symptoms({ dict }: { dict: I18nRecord }) {
  const { currentPage, setCurrentPage } = useOperatorPagination();

  return (
    <div className="w-full flex flex-col gap-4">
      <Label className="w-full flex text-left text-lg">
        {(dict.symptoms as I18nRecord).symptoms as string}
      </Label>
      <div className="z-50 h-full flex flex-col gap-2 overflow-visible">
        <TableComponent
          dict={dict}
          pagination={{
            currentPage,
            setCurrentPage,
          }}
          compact={true}
        />
      </div>
    </div>
  );
}
