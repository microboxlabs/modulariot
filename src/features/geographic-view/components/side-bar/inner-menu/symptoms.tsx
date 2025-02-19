import { Label } from "flowbite-react";
import TableComponent from "@/features/symptoms/components/table-component";
export default function Symptoms({ dict }: { dict: any }) {
  return (
    <div className="w-full flex flex-col gap-4">
      <Label className="w-full flex text-left text-lg">
        {dict.symptoms.symptoms}
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
