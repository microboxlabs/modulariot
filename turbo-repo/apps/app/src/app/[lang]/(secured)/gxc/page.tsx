import { Suspense } from "react";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { Visor } from "@/features/gxc/components/visor";

export default async function GxcVisorPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  return (
    <Suspense>
      <Visor lang={lang} />
    </Suspense>
  );
}
