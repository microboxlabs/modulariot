import { Card } from "flowbite-react";
import SymptomsDataSkeleton from "./symptoms-data-skeleton";

export default function SymptomsListSkeleton() {
  return (
    <div className="relative overflow-visible px-5 flex flex-col gap-3">
      <Card
        className="flex flex-row bg-gray-100 dark:bg-gray-800"
        color="white"
        theme={{
          root: {
            children: "p-2",
          },
        }}
      >
        <div className="flex flex-row gap-2 items-center justify-center animate-pulse">
          <div className="w-[50px] h-[50px] bg-gray-200 dark:bg-gray-700 rounded-full" />
          <h1 className="text-2xl font-bold tracking-tight text-gray-200 dark:text-gray-700 bg-gray-200 dark:bg-gray-700 rounded-lg">
            Sintomas urgentes: codigo negro
          </h1>
        </div>
      </Card>
      <div className="flex flex-col gap-6">
        <SymptomsDataSkeleton />
      </div>
    </div>
  );
}
