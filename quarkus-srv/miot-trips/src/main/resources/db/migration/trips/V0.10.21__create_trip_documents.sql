-- ============================================================
-- V0.10.21 — documents of a trip (multimedia).
--   Images and PDFs people add to the trip's file, each with a
--   document type. Replacing the file keeps the earlier version.
--   A document whose type needs review has a status and the
--   review rounds that decided it, each against one version.
--   A document may prove a delivery (POD).
-- ============================================================

CREATE TABLE miot_trips.trip_document (
    id             UUID          PRIMARY KEY,
    tenant_code    VARCHAR(128)  NOT NULL,
    trip_id        UUID          NOT NULL REFERENCES miot_trips.trip (id) ON DELETE CASCADE,
    content_id     UUID          NOT NULL,
    name           VARCHAR(255)  NOT NULL,
    doc_type       VARCHAR(64)   NOT NULL,
    version        INT           NOT NULL DEFAULT 1,
    reviewable     BOOLEAN       NOT NULL DEFAULT FALSE,
    review_status  VARCHAR(16)   CHECK (review_status IN ('pending', 'approved', 'rejected')),
    reviewed_at    TIMESTAMPTZ,
    reviewed_by    VARCHAR(255),
    delivery_id    UUID          REFERENCES miot_trips.delivery (id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by     VARCHAR(255),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_by     VARCHAR(255),
    CHECK (reviewable OR review_status IS NULL)
);
CREATE INDEX idx_trip_document_trip ON miot_trips.trip_document (tenant_code, trip_id);

CREATE TABLE miot_trips.trip_document_version (
    document_id  UUID          NOT NULL REFERENCES miot_trips.trip_document (id) ON DELETE CASCADE,
    version      INT           NOT NULL,
    content_id   UUID          NOT NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by   VARCHAR(255),
    PRIMARY KEY (document_id, version)
);

CREATE TABLE miot_trips.trip_document_review (
    document_id  UUID          NOT NULL REFERENCES miot_trips.trip_document (id) ON DELETE CASCADE,
    seq          INT           NOT NULL,
    version      INT           NOT NULL,
    verdict      VARCHAR(16)   NOT NULL CHECK (verdict IN ('APPROVED', 'REJECTED', 'PENDING')),
    reasons      TEXT[]        NOT NULL DEFAULT '{}',
    comment      TEXT,
    reviewed_by  VARCHAR(255)  NOT NULL,
    decided_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    PRIMARY KEY (document_id, seq)
);
