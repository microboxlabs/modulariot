import type { Metadata } from "next";
import Nav from "../../../../components/v2/Nav";
import ContactForm from "../../../../components/v2/ContactForm";
import { Footer } from "../../../../components/v2/sections/Footer";

export const metadata: Metadata = {
  title: "Contacto — ModularIoT",
  description: "Agenda un demo, pide una cotización o escríbenos. Te respondemos en menos de 24 horas.",
};

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
    <>
      <Nav />
      <main>
        <ContactForm lang={lang} initialIntent={initialIntent} base={base} />
      </main>
      <Footer base={base} lang={lang} />
    </>
  );
}
