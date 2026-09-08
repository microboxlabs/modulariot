import { Suspense } from "react";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import { Visor } from "@/features/gxc/components/visor";

export default async function GxcVisorPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  return (
    <Suspense>
      <Visor lang={lang} dict={dictionary} />
    </Suspense>
  );
}
