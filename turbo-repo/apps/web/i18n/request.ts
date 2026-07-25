import { getRequestConfig } from "next-intl/server";
import es from "../messages/es.json";
import en from "../messages/en.json";
import br from "../messages/br.json";

// Sin middleware/routing de next-intl: el idioma ya lo resuelve el segmento
// [lang] existente (es | en | pt). "pt" carga br.json (portugués de Brasil).
const messagesByLocale = { es, en, pt: br } as const;

export function getMessages(locale: string) {
  return messagesByLocale[locale as keyof typeof messagesByLocale] ?? messagesByLocale.es;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && requested in messagesByLocale ? requested : "es";
  return {
    locale,
    messages: getMessages(locale),
  };
});
