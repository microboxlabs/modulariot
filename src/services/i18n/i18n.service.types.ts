export type I18nRecord = {
  [key: string]: object | string;
};

export type I18nDictionries = Record<string, () => Promise<I18nRecord>>;
