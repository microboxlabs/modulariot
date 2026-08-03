import type { Metadata } from "next";
import ModuleTabs from "../../../../components/v2/ModuleTabs";
import TorreDeControl from "../../../../components/v2/TorreDeControl";
import { FinalCta } from "../../../../components/v2/sections/FinalCta";
import { pageMetadata, type Lang } from "../../../../lib/seo";

const META: Record<Lang, { title: string; description: string }> = {
  es: {
    title: "Torre de control — ModularIoT",
    description:
      "Explorador del catálogo real de síntomas: cada desviación se ve, se entiende, se actúa, se resuelve y se mejora. Con datos de una operación real.",
  },
  en: {
    title: "Control Tower — ModularIoT",
    description:
      "An explorer for the real symptom catalog: every deviation is seen, understood, acted on, resolved and improved. Built on data from a real operation.",
  },
  pt: {
    title: "Torre de Controle — ModularIoT",
    description:
      "Explorador do catálogo real de sintomas: cada desvio é visto, entendido, tratado, resolvido e melhorado. Com dados de uma operação real.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: Lang }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const { title, description } = META[lang] ?? META.es;
  return pageMetadata({ lang, path: "/torre", title, description });
}

export default async function TorrePage({
  params,
}: {
  params: Promise<{ lang: "en" | "es" | "pt" }>;
}) {
  const { lang } = await params;
  const base = `/alpha-2506/${lang}`;
  return (
    <>
      <ModuleTabs base={base} active="torre" lang={lang} />
      <main>
        <TorreDeControl lang={lang} />
        <FinalCta lang={lang} base={base} />
      </main>
    </>
  );
}
