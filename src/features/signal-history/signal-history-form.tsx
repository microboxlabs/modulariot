"use client";

import { Button, Label, TextInput } from "flowbite-react";
import ParametrizedSearchBar from "../layout/components/secured-navbar/searchbar/parametrized-searchbar";
import { getNavegationParams } from "../layout/components/secured-navbar/searchbar/navegation_params";
import { useSearchParams } from "next/navigation";
import DateRangePicker from "@/features/common/components/date-picker/date-range-picker";

export default function SignalHistoryForm({
  dict,
  messages,
}: {
  dict: any;
  messages: any;
}) {
  const searchParams = useSearchParams();
  const navegation_params = getNavegationParams(dict, 1);

  return (
    <div className="w-fit h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
      <h1 className="text-gray-700 dark:text-gray-200 font-bold text-2xl md:text-4xl text-center">
        Historial de señales
      </h1>
      <h1 className="text-gray-600 dark:text-gray-400 font-light text-lg mb-4 text-center px-10 md:px-0">
        Busca señales historicas por fecha y patente
      </h1>
      <div className="w-fit h-fit flex flex-col gap-4">
        <div className="w-fit h-fit flex flex-col gap-1">
          <Label htmlFor="search" className="text-left !text-gray-400">
            Patente
          </Label>
          <TextInput
            className="w-full lg:w-96"
            id="search"
            placeholder={messages.search}
            defaultValue={searchParams.get("search") || ""}
            autoComplete="off"
          />
        </div>
        <div className="w-full h-fit flex flex-col gap-1">
          <div>
            <label
              htmlFor="first_name"
              className="block mb-2.5 text-sm font-medium text-heading"
            >
              Rango de fechas
            </label>
            <DateRangePicker
              onDateChange={(startDate: string, endDate: string) => {}}
              className="w-full"
            />
          </div>

          <Button type="submit" className="w-full">
            Buscar
          </Button>
        </div>
      </div>
    </div>
  );
}
