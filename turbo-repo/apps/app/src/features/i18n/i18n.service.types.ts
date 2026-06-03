import type { TrKey } from "./tr.types";

export type I18nRecord = {
  [key: string]: I18nRecord | string;
};

/** A rooted translate function whose key is type-checked against the dictionary. */
export type TrFn = (path: TrKey, params?: Record<string, string>) => string;

/** Escape-hatch translate function for runtime-built keys (key not type-checked). */
export type TrDynamicFn = (
  path: string,
  params?: Record<string, string>
) => string;

// Use the canonical Spanish (default-locale) dictionary shape to type all
// dictionaries so nested property access (e.g., dict.pages.transportValidationForm)
// is fully typed without manual casts at each level. es is the source of truth;
// en is kept structurally identical by the locale-parity test.
export type I18nDictionary = typeof import("@/lang/es.json");

export type I18nDictionries<T = I18nRecord> = Record<string, () => Promise<T>>;

export type MessagesType = {
  messages: TrFn;
};

export type MessageTypeClientSide = {
  messages: Record<string, string>;
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
