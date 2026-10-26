-- ============================================================
-- V0.10.20 — deliveries of a trip's loads.
--   A delivery covers one or more mandates of the trip that go to
--   one customer; a mandate is in at most one delivery of a trip.
--   Its steps (delivered, accepted, settled) are confirmed in the
--   order the trip's monitor sets. Proofs (POD) are files in
--   miot_core.content or links to a file kept elsewhere.
-- ============================================================

CREATE TABLE miot_trips.delivery (
    id           UUID         PRIMARY KEY,
    tenant_code  VARCHAR(128) NOT NULL,
    trip_id      UUID         NOT NULL REFERENCES miot_trips.trip (id) ON DELETE CASCADE,
    reference    VARCHAR(128),
    customer     VARCHAR(255),
    source       VARCHAR(32),
    evidence     JSONB        NOT NULL DEFAULT '{}',
    note         TEXT,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by   VARCHAR(255),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by   VARCHAR(255)
);
CREATE INDEX idx_delivery_trip ON miot_trips.delivery (tenant_code, trip_id);
CREATE UNIQUE INDEX ux_delivery_reference ON miot_trips.delivery (trip_id, reference) WHERE reference IS NOT NULL;

CREATE TABLE miot_trips.delivery_mandate (
    delivery_id  UUID NOT NULL REFERENCES miot_trips.delivery (id) ON DELETE CASCADE,
    trip_id      UUID NOT NULL,
    mandate_id   UUID NOT NULL,
    PRIMARY KEY (delivery_id, mandate_id)
);
CREATE UNIQUE INDEX ux_delivery_mandate_trip ON miot_trips.delivery_mandate (trip_id, mandate_id);

CREATE TABLE miot_trips.delivery_step (
    delivery_id   UUID         NOT NULL REFERENCES miot_trips.delivery (id) ON DELETE CASCADE,
    step          VARCHAR(16)  NOT NULL CHECK (step IN ('delivered', 'accepted', 'settled')),
    tenant_code   VARCHAR(128) NOT NULL,
    status        VARCHAR(16)  NOT NULL CHECK (status IN ('pending', 'confirmed', 'rejected')),
    source        VARCHAR(32),
    proposed_at   TIMESTAMPTZ,
    evidence      JSONB        NOT NULL DEFAULT '{}',
    confirmed_at  TIMESTAMPTZ,
    confirmed_by  VARCHAR(255),
    channel       VARCHAR(16),
    note          TEXT,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by    VARCHAR(255),
    PRIMARY KEY (delivery_id, step)
);

CREATE TABLE miot_trips.delivery_proof (
    id           UUID          PRIMARY KEY,
    delivery_id  UUID          NOT NULL REFERENCES miot_trips.delivery (id) ON DELETE CASCADE,
    tenant_code  VARCHAR(128)  NOT NULL,
    kind         VARCHAR(16)   NOT NULL CHECK (kind IN ('signature', 'photo', 'document', 'other')),
    content_id   UUID,
    url          VARCHAR(2048),
    name         VARCHAR(255),
    mimetype     VARCHAR(128),
    metadata     JSONB         NOT NULL DEFAULT '{}',
    source       VARCHAR(32),
    received_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    received_by  VARCHAR(255),
    CHECK (content_id IS NOT NULL OR url IS NOT NULL)
);
CREATE INDEX idx_delivery_proof_delivery ON miot_trips.delivery_proof (delivery_id);
