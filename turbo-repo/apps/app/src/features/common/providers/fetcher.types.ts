/**
 * Structure of error info that may be returned from API responses
 */
export interface FetcherErrorInfo {
  error?: {
    code?: string;
    message?: string;
    details?: {
      involvedObject?: {
        respuesta?: string;
      };
      [key: string]: unknown;
    };
  };
  [key: string]: unknown;
}

export type FetcherError = Error & {
  info: FetcherErrorInfo | string | null;
  status: number;
  code?: string;
};

/**
 * Error codes for fetcher errors
 */
export const FetcherErrorCode = {
  /** Server returned non-JSON response (HTML error page, timeout page, etc.) */
  INVALID_RESPONSE_FORMAT: "INVALID_RESPONSE_FORMAT",
  /** JSON parsing failed */
  JSON_PARSE_ERROR: "JSON_PARSE_ERROR",
  /** Network timeout or connection error */
  NETWORK_ERROR: "NETWORK_ERROR",
  /** Server error (5xx) */
  SERVER_ERROR: "SERVER_ERROR",
  /** Client error (4xx) */
  CLIENT_ERROR: "CLIENT_ERROR",
  /** Action error (4xx) */
  ACTION_ERROR: "ACTION_ERROR",
  
} as const;

