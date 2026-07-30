import type { Metadata } from "next";
import ModuleTabs from "../../../../components/v2/ModuleTabs";
import TorreDeControl from "../../../../components/v2/TorreDeControl";
import { FinalCta } from "../../../../components/v2/sections/FinalCta";

export const metadata: Metadata = {
  title: "Torre de control — ModularIoT",
  description:
    "Explorador del catálogo real de síntomas: cada desviación se ve, se entiende, se actúa, se resuelve y se mejora. Con datos de una operación real.",
};

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
        <TorreDeControl />
        <FinalCta lang={lang} />
      </main>
    </>
  );
}
