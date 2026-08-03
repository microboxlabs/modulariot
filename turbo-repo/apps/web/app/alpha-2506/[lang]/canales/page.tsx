import type { Metadata } from "next";
import ModuleTabs from "../../../../components/v2/ModuleTabs";
import Canales from "../../../../components/v2/Canales";
import { FinalCta } from "../../../../components/v2/sections/FinalCta";
import { pageMetadata, type Lang } from "../../../../lib/seo";

const META: Record<Lang, { title: string; description: string }> = {
  es: {
    title: "Canales de escalamiento — ModularIoT",
    description:
      "La misma alerta — nivel, riesgo, foco y plan — entregada donde vive la operación: correo, WhatsApp, Teams, Webex y SMS.",
  },
  en: {
    title: "Escalation Channels — ModularIoT",
    description:
      "The same alert — level, risk, focus and plan — delivered where the operation lives: email, WhatsApp, Teams, Webex and SMS.",
  },
  pt: {
    title: "Canais de Escalonamento — ModularIoT",
    description:
      "O mesmo alerta — nível, risco, foco e plano — entregue onde a operação vive: e-mail, WhatsApp, Teams, Webex e SMS.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: Lang }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const { title, description } = META[lang] ?? META.es;
  return pageMetadata({ lang, path: "/canales", title, description });
}

export default async function CanalesPage({
  params,
}: {
  params: Promise<{ lang: "en" | "es" | "pt" }>;
}) {
  const { lang } = await params;
  const base = `/alpha-2506/${lang}`;
  return (
    <>
      <ModuleTabs base={base} active="canales" lang={lang} />
      <main>
        <Canales lang={lang} />
        <FinalCta lang={lang} base={base} />
      </main>
    </>
  );
}
