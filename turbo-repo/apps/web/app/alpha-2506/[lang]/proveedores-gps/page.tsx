import type { Metadata } from "next";
import ModuleTabs from "../../../../components/v2/ModuleTabs";
import GpsProviders from "../../../../components/v2/GpsProviders";
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
    path: "/proveedores-gps",
    title: "Proveedores GPS — ModularIoT",
    description:
      "Qué tan precisa es la señal de cada proveedor GPS: pulsos por minuto en movimiento contra el estándar de precisión (12) y minería (20).",
  });
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
        <FinalCta lang={lang} />
      </main>
    </>
  );
}
