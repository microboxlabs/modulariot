/**
 * Mock credentials for the review-integration picker.
 *
 * The real screen already exists (Settings › Credentials, backed by
 * miot-integrations). This stub lets the mockup demo the "connect a credential"
 * step without org-owner access or a live API. The shape is the subset the
 * picker needs; swapping onto the real feed later is `useCredentials(orgSlug)`
 * mapped to this shape (id, name, environment, summary, verified).
 *
 * Generic on purpose — public repo, so no real partner, tenant or client names.
 */
export interface ReviewCredentialOption {
  readonly id: string;
  readonly name: string;
  readonly environment: string;
  /** Non-secret identifying detail (e.g. masked client id). */
  readonly summary: string;
  /** Whether its last connection test passed — surfaced as a badge. */
  readonly verified: boolean;
}

export const MOCK_REVIEW_CREDENTIALS: readonly ReviewCredentialOption[] = [
  {
    id: "cred-partner-prod",
    name: "Partner API · Producción",
    environment: "PRODUCTION",
    summary: "client_id b3f2…9a1c",
    verified: true,
  },
  {
    id: "cred-partner-qa",
    name: "Partner API · QA",
    environment: "QA",
    summary: "client_id 7d10…44ef",
    verified: true,
  },
  {
    id: "cred-partner-sandbox",
    name: "Partner API · Sandbox",
    environment: "DEVELOPMENT",
    summary: "client_id 19f8…48a0",
    verified: false,
  },
];

export function findMockCredential(
  id: string | null
): ReviewCredentialOption | undefined {
  return MOCK_REVIEW_CREDENTIALS.find((credential) => credential.id === id);
}
