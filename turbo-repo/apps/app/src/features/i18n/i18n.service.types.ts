export type I18nRecord = {
  [key: string]: I18nRecord | string;
};

// Use the canonical English dictionary shape to type all dictionaries so
// nested property access (e.g., dict.pages.transportValidationForm) is
// fully typed without manual casts at each level.
export type I18nDictionary = typeof import("@/lang/en.json");

export type I18nDictionries<T = I18nRecord> = Record<string, () => Promise<T>>;

export type MessagesType = {
  messages: (path: string, params?: Record<string, string>) => string;
};

export type ParamsWithLang<P = Record<string, unknown>> = Readonly<{
  params: Promise<
    {
      lang: string;
    } & P
  >;
}>;

export type PropsWithI18nDict<P = unknown> = {
  dict: I18nRecord;
} & P;
