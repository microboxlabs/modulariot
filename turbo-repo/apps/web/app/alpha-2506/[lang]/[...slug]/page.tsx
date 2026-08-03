import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DetailPage from "../../../../components/v2/DetailPage";
import { getAllDetailSlugs, getDetailPageData } from "../../../../components/v2/detail-content";
import { pageMetadata, type Lang } from "../../../../lib/seo";

// Catch-all: resuelve todas las páginas de detalle (producto/*, soluciones, recursos).
// Config estructural en detail-content.ts, texto en messages/{lang}.json (namespace "detail").
// Las rutas específicas (precios, index) tienen prioridad.

export function generateStaticParams() {
  return getAllDetailSlugs().flatMap((key) =>
    ["es", "en", "pt"].map((lang) => ({ lang, slug: key.split("/") })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: Lang; slug: string[] }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const path = slug.join("/");
  const data = await getDetailPageData(lang, path);
  if (!data) return {};
  return pageMetadata({
    lang,
    path: `/${path}`,
    title: `${data.title} — ModularIoT`,
    description: data.subtitle,
  });
}

export default async function CatchAllDetail({
  params,
}: {
  params: Promise<{ lang: string; slug: string[] }>;
}) {
  const { lang, slug } = await params;
  const data = await getDetailPageData(lang, slug.join("/"));
  if (!data) notFound();
  return <DetailPage data={data} base={`/alpha-2506/${lang}`} />;
}
