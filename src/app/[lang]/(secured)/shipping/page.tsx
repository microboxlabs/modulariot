import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import KanbanPageContent from "@/features/shipping/components/content";
import { getData } from "@/features/shipping/services/data.service";

export default async function ShippingPage({
  params: { lang },
}: ParamsWithLang) {
  const [, dictionary] = await getDictionary(lang);
  return (
    <KanbanPageContent
      {...await getData()}
      dict={
        ((dictionary.pages as I18nRecord)?.shipping as I18nRecord)
          ?.kanban as I18nRecord
      }
    />
  );
}
