import type { Metadata } from "next";
import ModuleTabs from "../../../components/v2/ModuleTabs";
import SuperProfile from "../../../components/v2/SuperProfile";
import { FinalCta } from "../../../components/v2/sections/FinalCta";
import { pageMetadata, type Lang } from "../../../lib/seo";

const META: Record<Lang, { title: string; description: string }> = {
  es: {
    title: "SuperProfile — ModularIoT",
    description:
      "La identidad operacional viva de cada conductor, transportista y activo: nivel, riesgo, historia, comportamiento y plan, desde datos reales.",
  },
  en: {
    title: "SuperProfile — ModularIoT",
    description:
      "The living operational identity of every driver, carrier and asset: level, risk, history, behavior and plan, built from real data.",
  },
  pt: {
    title: "SuperProfile — ModularIoT",
    description:
      "A identidade operacional viva de cada motorista, transportadora e ativo: nível, risco, histórico, comportamento e plano, a partir de dados reais.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: Lang }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const { title, description } = META[lang] ?? META.es;
  return pageMetadata({ lang, path: "/superprofile", title, description });
}

export default async function SuperProfilePage({
  params,
}: {
  params: Promise<{ lang: "en" | "es" | "pt" }>;
}) {
  const { lang } = await params;
  const base = `/${lang}`;
  return (
    <>
      <ModuleTabs base={base} active="superprofile" lang={lang} />
      <main>
        <SuperProfile lang={lang} />
        <FinalCta lang={lang} base={base} />
      </main>
    </>
  );
}
