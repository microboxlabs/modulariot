import type { Metadata } from "next";
import Nav from "../../../../components/v2/Nav";
import ModuleTabs from "../../../../components/v2/ModuleTabs";
import GpsProviders from "../../../../components/v2/GpsProviders";
import { Footer } from "../../../../components/v2/sections/Footer";
import { FinalCta } from "../../../../components/v2/sections/FinalCta";

export const metadata: Metadata = {
  title: "Proveedores GPS — ModularIoT",
  description:
    "Qué tan precisa es la señal de cada proveedor GPS: pulsos por minuto en movimiento contra el estándar de precisión (12) y minería (20).",
};

export default async function ProveedoresGpsPage({
  params,
}: {
  params: Promise<{ lang: "en" | "es" | "pt" }>;
}) {
  const { lang } = await params;
  const base = `/alpha-2506/${lang}`;
  return (
    <>
      <Nav />
      <ModuleTabs base={base} active="gps" lang={lang} />
      <main>
        <GpsProviders />
        <FinalCta lang={lang} />
      </main>
      <Footer base={base} lang={lang} />
    </>
  );
}
