export type FetcherError = Error & {
  info: any;
  status: number;
};
