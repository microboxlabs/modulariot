-- The platform's Resend key is now created with public_config {"provider": "resend"}, like an
-- organization's, so Credenciales and the email channel list it as Resend. Keys saved before that
-- have an empty public_config; tag the ones the platform's Resend connection uses.

UPDATE miot_integrations.credential_profiles p
SET public_config = p.public_config || '{"provider": "resend"}'::jsonb
FROM miot_integrations.integration_connections c
WHERE c.credential_profile_id = p.id
  AND c.tenant_code = '_platform'
  AND c.provider_type = 'RESEND'
  AND NOT (p.public_config ? 'provider');
