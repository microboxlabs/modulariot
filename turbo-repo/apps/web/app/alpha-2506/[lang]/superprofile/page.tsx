import type { Metadata } from "next";
import ModuleTabs from "../../../../components/v2/ModuleTabs";
import SuperProfile from "../../../../components/v2/SuperProfile";
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
    path: "/superprofile",
    title: "SuperProfile — ModularIoT",
    description:
      "La identidad operacional viva de cada conductor, transportista y activo: nivel, riesgo, historia, comportamiento y plan, desde datos reales.",
  });
}

export default async function SuperProfilePage({
  params,
}: {
  params: Promise<{ lang: "en" | "es" | "pt" }>;
}) {
  const { lang } = await params;
  const base = `/alpha-2506/${lang}`;
  return (
    <>
      <ModuleTabs base={base} active="superprofile" lang={lang} />
      <main>
        <SuperProfile lang={lang} />
        <FinalCta lang={lang} />
      </main>
    </>
  );
}
