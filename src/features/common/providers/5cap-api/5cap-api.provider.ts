import fetcher from "../fetcher";
import {
  ContentRequest,
  DocumentTypesResult,
  LoginResult,
  ContentResult,
} from "./5cap-api.provider.types";

export function login(): Promise<LoginResult> {
  const url = `${process.env.CAP_API_URL}/auth/login`;
  return fetcher(url, {
    headers: {
      "X-API-KEY": process.env.CAP_API_KEY as string,
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify({
      user_name: process.env.CAP_USER as string,
      user_pin: process.env.CAP_USER_PIN as string,
    }),
  });
}

export function getDocumentTypes(
  institutionId: string,
  sessionId: string,
): Promise<DocumentTypesResult> {
  const url = `${process.env.CAP_API_URL}/document_type/list?institution=${institutionId}&session_id=${sessionId}`;
  return fetcher(url, {
    headers: {
      "X-API-KEY": process.env.CAP_API_KEY as string,
      "Content-Type": "application/json",
    },
  });
}

export function createContent(
  contentRequest: ContentRequest,
): Promise<ContentResult> {
  const url = `${process.env.CAP_API_URL}/documents/create`;
  return fetcher(url, {
    headers: {
      "X-API-KEY": process.env.CAP_API_KEY as string,
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify(contentRequest),
  });
}
