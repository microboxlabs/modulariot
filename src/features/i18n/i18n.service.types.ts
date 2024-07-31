export type I18nRecord = {
  [key: string]: object | string;
};

export type I18nDictionries = Record<string, () => Promise<I18nRecord>>;

export type MessagesType = {
  messages: (path: string, params?: Record<string, string>) => string;
};

export type MessageTypeClientSide = {
  messages: Record<string, string>;
};
