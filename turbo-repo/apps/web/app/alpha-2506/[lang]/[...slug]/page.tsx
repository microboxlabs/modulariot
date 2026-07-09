import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DetailPage from "../../../../components/v2/DetailPage";
import { detailPages, getDetailPages } from "../../../../components/v2/detail-content";

// Catch-all: resuelve todas las páginas de detalle (producto/*, soluciones, recursos)
// desde detail-content.ts. Las rutas específicas (precios, index) tienen prioridad.

export function generateStaticParams() {
  return Object.keys(detailPages).flatMap((key) =>
    ["es", "en", "pt"].map((lang) => ({ lang, slug: key.split("/") })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string[] }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const data = getDetailPages(lang)[slug.join("/")];
  if (!data) return {};
  return { title: `${data.title} — ModularIoT`, description: data.subtitle };
}

export default async function CatchAllDetail({
  params,
}: {
  params: Promise<{ lang: string; slug: string[] }>;
}) {
  const { lang, slug } = await params;
  const data = getDetailPages(lang)[slug.join("/")];
  if (!data) notFound();
  return <DetailPage data={data} base={`/alpha-2506/${lang}`} />;
}
