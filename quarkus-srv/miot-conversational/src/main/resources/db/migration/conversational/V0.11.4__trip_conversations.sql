-- ============================================================
-- V0.11.4 — conversations about a trip.
--   A notice of the trips module (a departure to confirm, an
--   overdue closure) starts a conversation whose context is the
--   trip, so its replies go back to that trip.
-- ============================================================

ALTER TABLE miot_conversational.wa_conversation
    DROP CONSTRAINT chk_wa_conversation_context_kind,
    ADD CONSTRAINT chk_wa_conversation_context_kind CHECK (
        context_kind IS NULL OR context_kind IN ('service', 'symptom_case', 'document', 'job', 'trip'));
