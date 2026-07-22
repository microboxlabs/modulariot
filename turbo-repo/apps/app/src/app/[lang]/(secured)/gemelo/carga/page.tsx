import { Suspense } from "react";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { Carga } from "@/features/gemelo-carga/components/carga";

export default async function GemeloCargaPage({ params }: ParamsWithLang) {
  await params;
  return (
    <Suspense>
      <Carga />
    </Suspense>
  );
}
