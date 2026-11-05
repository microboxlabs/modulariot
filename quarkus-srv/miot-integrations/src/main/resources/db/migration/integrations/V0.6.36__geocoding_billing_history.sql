-- Preserve the month-effective billing terms without changing deployed V0.6.34.
-- Existing rows establish the earliest known version, at their last update.
-- Earlier overwritten terms cannot be reconstructed and must not be guessed.
CREATE TABLE miot_integrations.geocoding_billing_history (
    version_id   BIGSERIAL PRIMARY KEY,
    kind         VARCHAR(16) NOT NULL CHECK (kind IN ('plan', 'subscription')),
    organization VARCHAR(128) NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL,
    snapshot     JSONB NOT NULL,
    active       BOOLEAN NOT NULL DEFAULT true,
    CHECK ((kind = 'plan' AND organization = '') OR (kind = 'subscription' AND organization <> ''))
);
CREATE INDEX geocoding_billing_history_lookup_idx
    ON miot_integrations.geocoding_billing_history (kind, organization, effective_at DESC, version_id DESC);

INSERT INTO miot_integrations.geocoding_billing_history (kind, organization, effective_at, snapshot)
SELECT 'plan', '', updated_at, to_jsonb(p) FROM miot_integrations.geocoding_plan p;
INSERT INTO miot_integrations.geocoding_billing_history (kind, organization, effective_at, snapshot)
SELECT 'subscription', organization, updated_at, to_jsonb(s) FROM miot_integrations.geocoding_subscriptions s;

CREATE FUNCTION miot_integrations.record_geocoding_billing_terms() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    data JSONB;
    entry_kind TEXT;
BEGIN
    -- Quota alert bookkeeping does not create a billing version.
    IF TG_OP = 'UPDATE' AND
       (to_jsonb(OLD) - 'alerted_month' - 'updated_at' - 'updated_by') =
       (to_jsonb(NEW) - 'alerted_month' - 'updated_at' - 'updated_by') THEN
        RETURN NULL;
    END IF;
    IF TG_OP = 'DELETE' THEN data := to_jsonb(OLD); ELSE data := to_jsonb(NEW); END IF;
    entry_kind := CASE WHEN TG_TABLE_NAME = 'geocoding_plan' THEN 'plan' ELSE 'subscription' END;
    INSERT INTO miot_integrations.geocoding_billing_history
        (kind, organization, effective_at, snapshot, active)
    VALUES (entry_kind, coalesce(data->>'organization', ''), clock_timestamp(), data, TG_OP <> 'DELETE');
    RETURN NULL;
END;
$$;
CREATE TRIGGER geocoding_plan_billing_history
    AFTER INSERT OR UPDATE OR DELETE ON miot_integrations.geocoding_plan
    FOR EACH ROW EXECUTE FUNCTION miot_integrations.record_geocoding_billing_terms();
CREATE TRIGGER geocoding_subscription_billing_history
    AFTER INSERT OR UPDATE OR DELETE ON miot_integrations.geocoding_subscriptions
    FOR EACH ROW EXECUTE FUNCTION miot_integrations.record_geocoding_billing_terms();
