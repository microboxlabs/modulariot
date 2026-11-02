-- The quota alert becomes one template per event, each with a WhatsApp text and an HTML email. Local definitions
-- only: Meta submission is an explicit operator action.
DELETE FROM miot_conversational.conv_template t
WHERE t.tenant_code = '_platform' AND t.key = 'miot_geocoding_quota_alert'
  AND NOT EXISTS (SELECT 1 FROM miot_conversational.conv_rule_version v
                  WHERE v.spec::text LIKE '%miot_geocoding_quota_alert%');

INSERT INTO miot_conversational.conv_template
    (id, tenant_code, key, name, base_text, whatsapp, email, updated_by, version)
VALUES
(gen_random_uuid(), '_platform', 'miot_geocoding_quota_threshold', 'Geocodificación: aviso de cupo',
 E'*Geocodificación de {{company}}*\nLleva {{used}} de {{quota}} consultas este mes ({{pct}} %). {{action}} Revisa el consumo en ModularIoT.',
 '{"metaName":"miot_geocoding_quota_threshold","language":"es","params":["company","used","quota","pct","action"]}'::jsonb,
 jsonb_build_object(
   'subject', '{{company}} usó el {{pct}} % de su cupo de geocodificación',
   'html', $html$<h1 style="font-size:20px;margin:0 0 12px;color:#111827">Geocodificación de {{company}}</h1>
<p style="margin:0 0 8px">Este mes lleva <strong>{{used}} de {{quota}}</strong> consultas al proveedor de mapas ({{pct}} %).</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px">
<tr><td style="background:#1C64F2;height:8px;width:{{pct}}%"></td><td style="background:#E5E7EB;height:8px"></td></tr>
</table>
<p style="margin:0 0 16px">{{action}}</p>
{{#if link}}<p style="margin:0 0 16px"><a href="{{link}}" style="display:inline-block;padding:10px 16px;background:#1C64F2;color:#ffffff;font-weight:bold;text-decoration:none;border-radius:8px">Revisar el consumo</a></p>{{/if}}
<p style="margin:0;font-size:12px;color:#6B7280">Recibes este correo porque administras {{company}} en ModularIoT.</p>$html$),
 'migration', '0.1.0'),
(gen_random_uuid(), '_platform', 'miot_geocoding_quota_exhausted', 'Geocodificación: cupo agotado',
 E'*Geocodificación de {{company}}: cupo agotado*\nSe usaron las {{quota}} consultas incluidas este mes. {{action}} Revisa el consumo en ModularIoT.',
 '{"metaName":"miot_geocoding_quota_exhausted","language":"es","params":["company","quota","action"]}'::jsonb,
 jsonb_build_object(
   'subject', '{{company}} agotó su cupo de geocodificación de {{month}}',
   'html', $html$<h1 style="font-size:20px;margin:0 0 12px;color:#111827">{{company}} agotó su cupo de geocodificación</h1>
<p style="margin:0 0 8px">Este mes se usaron las <strong>{{quota}}</strong> consultas al proveedor de mapas incluidas en el plan.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px">
<tr><td style="background:#E02424;height:8px"></td></tr>
</table>
<p style="margin:0 0 16px"><strong>{{action}}</strong></p>
{{#if link}}<p style="margin:0 0 16px"><a href="{{link}}" style="display:inline-block;padding:10px 16px;background:#1C64F2;color:#ffffff;font-weight:bold;text-decoration:none;border-radius:8px">Revisar el consumo</a></p>{{/if}}
<p style="margin:0;font-size:12px;color:#6B7280">Recibes este correo porque administras {{company}} en ModularIoT.</p>$html$),
 'migration', '0.1.0')
ON CONFLICT (tenant_code, key) DO NOTHING;
