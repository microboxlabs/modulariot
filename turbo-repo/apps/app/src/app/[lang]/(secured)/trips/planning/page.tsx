import type { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { TripsBoardPage } from "@/features/trips/board/board-page";

export default async function Page({ params }: ParamsWithLang) {
  const { lang } = await params;
  return <TripsBoardPage view="planning" lang={lang} />;
}
