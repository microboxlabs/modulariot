-- Each organization's own speed limits, for signal.road.maxspeed_custom. A zone is a GeoJSON Polygon or
-- MultiPolygon in WGS 84. forward_from and forward_to (degrees clockwise from north, wrapping past 360) set the
-- bearings of travel that use speed_forward; the others use speed_backward. Without that range the zone has one
-- limit: speed_forward, else speed_backward. heading, when set, limits the zone to vehicles whose device heading
-- points the same way. Where zones overlap, the lowest id applies.

CREATE TABLE miot_symptoms.speed_limit_zone (
    id             SERIAL PRIMARY KEY,
    tenant_code    VARCHAR(128) NOT NULL,
    name           VARCHAR(255),
    shape          JSONB        NOT NULL,
    speed_forward  INTEGER,
    speed_backward INTEGER,
    forward_from   INTEGER,
    forward_to     INTEGER,
    heading        INTEGER,
    active         BOOLEAN      NOT NULL DEFAULT true,
    updated_by     VARCHAR(255) NOT NULL,
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_speed_limit_zone_speed CHECK ((speed_forward IS NOT NULL OR speed_backward IS NOT NULL)
        AND (speed_forward IS NULL OR speed_forward > 0) AND (speed_backward IS NULL OR speed_backward > 0)),
    CONSTRAINT chk_speed_limit_zone_range CHECK ((forward_from IS NULL) = (forward_to IS NULL)
        AND (forward_from IS NULL OR forward_from BETWEEN 0 AND 360 AND forward_to BETWEEN 0 AND 360)),
    CONSTRAINT chk_speed_limit_zone_heading CHECK (heading IS NULL OR heading BETWEEN 0 AND 360)
);

CREATE INDEX idx_speed_limit_zone_tenant ON miot_symptoms.speed_limit_zone (tenant_code) WHERE active;
