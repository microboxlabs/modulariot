"use client";

import dynamic from "next/dynamic";

// MapLibre/Mapbox/deck.gl tocan window → solo cliente
const ReplayMapa = dynamic(
  () => import("./replay-map").then((m) => m.ReplayMapa),
  { ssr: false }
);

export default function ReplayClient({ lang }: { lang: string }) {
  return <ReplayMapa lang={lang} />;
}
