import type { DataSourceFormData } from "./types";

/**
 * In edit mode the secret fields start blank, meaning "keep the existing
 * credential". A stateless test needs the actual credential, so when editing
 * with a blank credential we fall back to testing the persisted (stored) config
 * by id. Otherwise we test the typed form data statelessly.
 */
export function credentialIsBlank(data: DataSourceFormData): boolean {
  return data.authMethod === "TOKEN" ? !data.token : !data.clientSecret;
}

export function shouldTestStoredCredential(
  isEditing: boolean,
  data: DataSourceFormData
): boolean {
  return isEditing && credentialIsBlank(data);
}
