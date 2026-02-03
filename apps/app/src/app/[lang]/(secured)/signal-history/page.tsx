import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import SignalHistoryForm from "@/features/signal-history/signal-history-form";

export default async function WheresMyLoadPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [_, dictionary] = await getDictionary(lang);

  return (
    <div className="h-full w-full flex justify-center items-start p-2">
      <SignalHistoryForm dict={dictionary} />
    </div>
  );
}
