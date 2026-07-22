import { Suspense } from "react";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { Proceso } from "@/features/gemelo-proceso/components/proceso";

export default async function GemeloProcesoPage({ params }: ParamsWithLang) {
  await params;
  return (
    <Suspense>
      <Proceso />
    </Suspense>
  );
}
