-- The stored integration credential (an OAuth2 client_credentials profile) whose
-- token the service account's API keys are exchanged for at POST /api/v1/iam/token.
ALTER TABLE miot_iam.iam_service_account ADD COLUMN token_credential_ref VARCHAR(255);
