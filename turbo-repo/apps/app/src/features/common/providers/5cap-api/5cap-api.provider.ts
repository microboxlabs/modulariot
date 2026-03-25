import fetcher from "../fetcher";
import {
  ContentRequest,
  DocumentTypesResult,
  LoginResult,
  ContentResult,
  SignIdCardRequest,
  GetDocumentRequest,
  ValidateIdCardRequest,
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
  sessionId: string
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
  contentRequest: ContentRequest
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

export function createContentSign(
  contentRequest: ContentRequest
): Promise<ContentResult> {
  const url = `${process.env.CAP_API_URL}/documents/create_sign`;
  return fetcher(url, {
    headers: {
      "X-API-KEY": process.env.CAP_API_KEY as string,
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify(contentRequest),
  });
}

export function signIdCard(
  contentRequest: SignIdCardRequest
): Promise<ContentResult> {
  const url = `${process.env.CAP_API_URL}/sign/ci`;
  return fetcher(url, {
    headers: {
      "X-API-KEY": process.env.CAP_API_KEY as string,
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify(contentRequest),
  });
}

export function getDocument(
  contentRequest: GetDocumentRequest
): Promise<ContentResult> {
  const url = `${process.env.CAP_API_URL}/documents`;
  return fetcher(url, {
    headers: {
      "X-API-KEY": process.env.CAP_API_KEY as string,
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify(contentRequest),
  });
}

export function validateIdCard(
  contentRequest: ValidateIdCardRequest
): Promise<ContentResult> {
  const url = `${process.env.CAP_API_URL}/sign/ci`;
  return fetcher(url, {
    headers: {
      "X-API-KEY": process.env.CAP_API_KEY as string,
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify(contentRequest),
  });
}
