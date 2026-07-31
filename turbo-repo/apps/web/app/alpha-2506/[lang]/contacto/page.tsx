import type { Metadata } from "next";
import ContactForm from "../../../../components/v2/ContactForm";
import { pageMetadata, type Lang } from "../../../../lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: Lang }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return pageMetadata({
    lang,
    path: "/contacto",
    title: "Contacto — ModularIoT",
    description: "Agenda un demo, pide una cotización o escríbenos. Te respondemos en menos de 24 horas.",
  });
}

type Intent = "demo" | "cotizar" | "general";
const INTENTS: Intent[] = ["demo", "cotizar", "general"];

export default async function ContactoPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: "en" | "es" | "pt" }>;
  searchParams: Promise<{ intent?: string }>;
}) {
  const { lang } = await params;
  const { intent } = await searchParams;
  const base = `/alpha-2506/${lang}`;
  const initialIntent: Intent = INTENTS.includes(intent as Intent) ? (intent as Intent) : "demo";
  return (
    <main>
      <ContactForm lang={lang} initialIntent={initialIntent} base={base} />
    </main>
  );
}
