import type { Metadata } from "next";
import Nav from "../../../../components/v2/Nav";
import ModuleTabs from "../../../../components/v2/ModuleTabs";
import Canales from "../../../../components/v2/Canales";
import { Footer, FinalCta } from "../../../../components/v2/Sections";

export const metadata: Metadata = {
  title: "Canales de escalamiento — ModularIoT",
  description:
    "La misma alerta — nivel, riesgo, foco y plan — entregada donde vive la operación: correo, WhatsApp, Teams, Webex y SMS.",
};

export default async function CanalesPage({
  params,
}: {
  params: Promise<{ lang: "en" | "es" | "pt" }>;
}) {
  const { lang } = await params;
  const base = `/alpha-2506/${lang}`;
  return (
    <>
      <Nav />
      <ModuleTabs base={base} active="canales" lang={lang} />
      <main>
        <Canales />
        <FinalCta lang={lang} />
      </main>
      <Footer base={base} lang={lang} />
    </>
  );
}
