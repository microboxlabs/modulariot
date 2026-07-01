-- Fork the conversation grain from per-phone to per-SERVICE.
--
-- A driver runs exactly one service at a time (presentDriver → confirmArrival → delivery tail), so
-- the conversation is now identified by the service it is about (context_service_code), not by the
-- phone number. A phone hosts many service threads over its lifetime; inbound replies attach to the
-- newest thread for that phone (the current service). This replaces the "WhatsApp mirror" model
-- (one perpetual per-phone thread with a single mutable current-service pointer).
--
-- context_service_code is repurposed as the thread's IMMUTABLE service identity (it already held
-- this value on trip-tied threads). Rows with a NULL service are "unassigned" threads — the home
-- for cold inbound that arrives before any service claims the number.

-- Defensive backfill: if earlier per-phone rows happen to share a service, keep only the most-recent
-- as that service's thread and demote the rest to unassigned, so the new unique index can be built.
-- No-op on typical single-thread dev data.
WITH ranked AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY tenant_code, context_service_code
               ORDER BY last_message_at DESC NULLS LAST, created_at DESC
           ) AS rn
      FROM miot_conversational.wa_conversation
     WHERE context_service_code IS NOT NULL
)
UPDATE miot_conversational.wa_conversation c
   SET context_service_code = NULL,
       context_process_instance_id = NULL,
       context_task_id = NULL,
       driver_id = NULL
  FROM ranked
 WHERE c.id = ranked.id
   AND ranked.rn > 1;

-- Swap identity: drop per-phone uniqueness, add per-service uniqueness.
DROP INDEX IF EXISTS miot_conversational.idx_wa_conversation_tenant_phone;

CREATE UNIQUE INDEX idx_wa_conversation_tenant_service
    ON miot_conversational.wa_conversation (tenant_code, context_service_code)
    WHERE context_service_code IS NOT NULL;

-- At most one open unassigned (no-service) thread per phone.
CREATE UNIQUE INDEX idx_wa_conversation_tenant_phone_unassigned
    ON miot_conversational.wa_conversation (tenant_code, phone_e164)
    WHERE context_service_code IS NULL AND status = 'OPEN';

-- Inbound attribution: find the newest thread for a phone. Column order/direction mirrors
-- findLatestByTenantAndPhone's ORDER BY so the lookup is covered without an extra sort.
CREATE INDEX idx_wa_conversation_tenant_phone_recent
    ON miot_conversational.wa_conversation (
        tenant_code, phone_e164, last_message_at DESC NULLS LAST, created_at DESC);
