-- Message templates belong to the platform: the reserved tenant 'platform' owns them and every organization's
-- rules use them. Each template gets a semantic version; the ones there are start at 0.1.0.
-- The organizations' templates move to the platform. A key the platform already has stays with its
-- organization, unused, so no template is lost.

ALTER TABLE miot_conversational.conv_template
    ADD COLUMN version VARCHAR(32) NOT NULL DEFAULT '0.1.0';

UPDATE miot_conversational.conv_template t
   SET tenant_code = 'platform'
 WHERE t.tenant_code <> 'platform'
   AND t.id = (SELECT min(o.id::text)::uuid FROM miot_conversational.conv_template o WHERE o.key = t.key)
   AND NOT EXISTS (SELECT 1 FROM miot_conversational.conv_template p
                    WHERE p.tenant_code = 'platform' AND p.key = t.key);
