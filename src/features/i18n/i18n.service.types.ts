export type I18nRecord = {
  [key: string]: I18nRecord | string;
};

export type I18nDictionries = Record<string, () => Promise<I18nRecord>>;

export type MessagesType = {
  messages: (path: string, params?: Record<string, string>) => string;
};

export type MessageTypeClientSide = {
  messages: Record<string, string>;
};

export type ParamsWithLang<P = Record<string, unknown>> = {
  params: Promise<{
    lang: string;
  } & P>;
};

export type PropsWithI18nDict<P = unknown> = {
  dict: I18nRecord;
} & P;
