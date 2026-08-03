import type { Metadata } from "next";
import ModuleTabs from "../../../../components/v2/ModuleTabs";
import GpsProviders from "../../../../components/v2/GpsProviders";
import { FinalCta } from "../../../../components/v2/sections/FinalCta";
import { pageMetadata, type Lang } from "../../../../lib/seo";

const META: Record<Lang, { title: string; description: string }> = {
  es: {
    title: "Proveedores GPS — ModularIoT",
    description:
      "Qué tan precisa es la señal de cada proveedor GPS: pulsos por minuto en movimiento contra el estándar de precisión (12) y minería (20).",
  },
  en: {
    title: "GPS Providers — ModularIoT",
    description:
      "How accurate each GPS provider's signal is: pulses per minute while moving against the precision standard (12) and mining (20).",
  },
  pt: {
    title: "Provedores GPS — ModularIoT",
    description:
      "Quão preciso é o sinal de cada provedor GPS: pulsos por minuto em movimento contra o padrão de precisão (12) e mineração (20).",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: Lang }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const { title, description } = META[lang] ?? META.es;
  return pageMetadata({ lang, path: "/proveedores-gps", title, description });
}

export default async function ProveedoresGpsPage({
  params,
}: {
  params: Promise<{ lang: "en" | "es" | "pt" }>;
}) {
  const { lang } = await params;
  const base = `/alpha-2506/${lang}`;
  return (
    <>
      <ModuleTabs base={base} active="gps" lang={lang} />
      <main>
        <GpsProviders lang={lang} />
        <FinalCta lang={lang} base={base} />
      </main>
    </>
  );
}
