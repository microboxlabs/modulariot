import { Card } from "flowbite-react";

export default function TitleCardSkeleton() {
  return (
    <div className=" mx-5 relative flex flex-col gap-10 rounded-lg">
      <Card
        className="flex flex-row animate-pulse bg-gray-100 dark:bg-gray-800"
        color="white"
        theme={{
          root: {
            children: "p-3",
          },
        }}
      >
        <div className="flex flex-row gap-2 items-center justify-center">
          <div className="w-[54px] h-[54px] rounded-full bg-gray-200 dark:bg-gray-700" />
          <h1 className="text-2xl font-bold tracking-tight text-gray-200 dark:text-gray-700 bg-gray-200 dark:bg-gray-700 rounded-lg">
            Sintoma urgente: Codigo negro
          </h1>
        </div>
      </Card>
    </div>
  );
}
