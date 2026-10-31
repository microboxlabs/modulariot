-- Whether the geocoding plan's quotas are applied. Off: no provider call is
-- refused; usage is still recorded, shown and alerted on. On: an organization
-- without a subscription gets no provider calls, and one past its quota gets
-- what its on_exhausted says. Set by the platform owner in Settings › Plataforma.
ALTER TABLE miot_integrations.geocoding_plan
    ADD COLUMN enforced BOOLEAN NOT NULL DEFAULT false;
