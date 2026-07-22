import { Suspense } from "react";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { Simulador } from "@/features/gemelo-simulador/components/simulador";

export default async function GemeloSimuladorPage({ params }: ParamsWithLang) {
  await params;
  return (
    <Suspense>
      <Simulador />
    </Suspense>
  );
}
