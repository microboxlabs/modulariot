import type { Metadata } from "next";
import ModuleTabs from "../../../../components/v2/ModuleTabs";
import TorreDeControl from "../../../../components/v2/TorreDeControl";
import { FinalCta } from "../../../../components/v2/sections/FinalCta";
import { pageMetadata, type Lang } from "../../../../lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: Lang }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return pageMetadata({
    lang,
    path: "/torre",
    title: "Torre de control — ModularIoT",
    description:
      "Explorador del catálogo real de síntomas: cada desviación se ve, se entiende, se actúa, se resuelve y se mejora. Con datos de una operación real.",
  });
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
        <FinalCta lang={lang} />
      </main>
    </>
  );
}
