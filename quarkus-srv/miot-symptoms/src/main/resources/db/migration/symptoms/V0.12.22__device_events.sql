-- Device events reach the engine through the control tower's device-events endpoint, as the frame's events
-- (signal.frame.events) of a signal that carries only them. Each event may carry the producer's code (code).
-- The driver-fatigue template 1.1.0 also reads the fatigue camera's code: 109, 112 and 115 are high, 105 is
-- medium, as the GPS database's fatigue function. Symptoms copied from 1.0.0 keep their rules.
--
-- device_event keeps the id of each event received, per organization, so a repeated event is not evaluated
-- twice. It keeps no payload.

CREATE TABLE miot_symptoms.device_event (
    tenant_code VARCHAR(128) NOT NULL,
    event_id    VARCHAR(128) NOT NULL,
    asset_id    VARCHAR(64)  NOT NULL,
    event_type  VARCHAR(64)  NOT NULL,
    occurred_at TIMESTAMPTZ  NOT NULL,
    received_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_device_event PRIMARY KEY (tenant_code, event_id)
);

CREATE INDEX idx_device_event_received_at ON miot_symptoms.device_event (received_at);

-- Independent device events can have the same timestamp. GPS frames still deduplicate by frame time;
-- device transitions deduplicate by the producer's event id, kept without the event payload in context.
DROP INDEX miot_symptoms.uq_signal_transitions_note;
CREATE UNIQUE INDEX uq_signal_transitions_note
    ON miot_symptoms.signal_transitions (tenant_code, definition_id, asset_id, at)
    WHERE kind = 'NOTED' AND context ->> 'event_id' IS NULL;
CREATE UNIQUE INDEX uq_signal_transitions_device_event
    ON miot_symptoms.signal_transitions
        (tenant_code, definition_id, asset_id, (context ->> 'event_id'), (kind = 'NOTED'))
    WHERE context ->> 'event_id' IS NOT NULL;

WITH upgrade (symptom_key, version, spec, bump, reason, description) AS (VALUES
    ('driver-fatigue', '1.1.0',
     '{"source":"gps_signal","activation":"signal.trip.active && signal.frame.events.exists(e, e.event_type == \"FYS\")","measure":{"expression":"signal.frame.events.exists(e, e.event_type == \"FYS\" && (e.severity == \"high\" || e.code in [\"109\", \"112\", \"115\"])) ? 2.0 : signal.frame.events.exists(e, e.event_type == \"FYS\" && (e.severity == \"medium\" || e.code == \"105\")) ? 1.0 : 0.0","label":"Gravedad del evento (0 baja, 1 media, 2 alta)","unit":"nivel"},"levels":[{"icu":1,"applies":true,"when":"measure < 1.0 && open_s < 300","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"measure < 2.0 && open_s < 600 && (measure >= 1.0 || open_s >= 300)","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"measure < 2.0 && open_s >= 600 && open_s < 900","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"measure >= 2.0 || open_s >= 900","response":{"operator":true,"slaMinutes":10,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.closed_by_operator || !signal.trip.active"},"family":"workday_fatigue","state":"OFF"}',
     'MINOR', 'También lee el código del evento de la cámara', 'En viaje, la cámara reporta fatiga; sube por la gravedad o el código del evento, o si se repite')
), published AS (
    INSERT INTO miot_symptoms.symptom_version
        (definition_id, tenant_code, version, status, spec, bump, reason, created_by, published_by, published_at)
    SELECT d.id, '_platform', u.version, 'PUBLISHED', u.spec::jsonb, u.bump, u.reason, 'platform-seed',
           'platform-seed', now()
    FROM upgrade u
    JOIN miot_symptoms.symptom_definition d ON d.tenant_code = '_platform' AND d.symptom_key = u.symptom_key
    ON CONFLICT DO NOTHING
    RETURNING definition_id
)
UPDATE miot_symptoms.symptom_definition d
SET current_version = u.version, description = u.description, updated_by = 'platform-seed', updated_at = now()
FROM upgrade u
WHERE d.tenant_code = '_platform' AND d.symptom_key = u.symptom_key;
