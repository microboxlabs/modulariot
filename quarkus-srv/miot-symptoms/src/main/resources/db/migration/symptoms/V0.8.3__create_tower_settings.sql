-- The operator team of each organization's Control Tower, for the operator
-- load card: how many operators, how long a shift is, how many cases a shift
-- can handle. One row per organization; no row means nothing is set yet.

CREATE TABLE miot_symptoms.tower_settings (
    tenant_code        VARCHAR(128) PRIMARY KEY,
    operators          INTEGER,
    shift_hours        INTEGER      NOT NULL DEFAULT 8,
    capacity_per_shift INTEGER,
    updated_by         VARCHAR(255) NOT NULL,
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_tower_settings_operators CHECK (operators IS NULL OR operators >= 0),
    CONSTRAINT chk_tower_settings_shift_hours CHECK (shift_hours BETWEEN 1 AND 24),
    CONSTRAINT chk_tower_settings_capacity CHECK (capacity_per_shift IS NULL OR capacity_per_shift >= 0)
);
