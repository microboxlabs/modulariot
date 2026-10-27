-- The platform's message templates move from tenant 'platform' to '_platform', the tenant of the platform scope.

UPDATE miot_conversational.conv_template SET tenant_code = '_platform' WHERE tenant_code = 'platform';
