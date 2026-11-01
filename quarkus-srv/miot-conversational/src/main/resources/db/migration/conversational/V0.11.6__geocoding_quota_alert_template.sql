-- Local definition only. Meta submission is an explicit operator action.
INSERT INTO miot_conversational.conv_template
    (id, tenant_code, key, name, base_text, whatsapp, updated_by, version)
VALUES (gen_random_uuid(), '_platform', 'miot_geocoding_quota_alert', 'Alerta de cuota de geocodificación',
    'Geocodificación de {{organization}}: {{used}} / {{quota}} llamadas ({{pct}}%). {{next_step}} Revisa el consumo en /app/es/users/settings/geocoding.',
    '{"metaName":"miot_geocoding_quota_alert","language":"es","params":["organization","used","quota","pct","next_step"]}'::jsonb,
    'migration', '0.1.0')
ON CONFLICT (tenant_code, key) DO NOTHING;
