import { Suspense } from "react";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import ReplayClient from "@/features/gemelo-replay/components/replay-client";

export default async function GemeloReplayPage({ params }: ParamsWithLang) {
  const { lang } = await params;

  return (
    <div className="h-full w-full overflow-hidden">
      <Suspense>
        <ReplayClient lang={lang} />
      </Suspense>
    </div>
  );
}
