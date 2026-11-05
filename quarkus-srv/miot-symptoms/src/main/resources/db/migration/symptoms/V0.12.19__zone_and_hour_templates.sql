-- Zone and hour templates with the escalation of the GPS database's signal rules. The zones come from the GPS
-- database's geofences (signal.geo: risk_zone for type 1, outside_authorized when in no zone or in one that is not
-- of type 0); the hours are local (signal.local_hour, signal.local_minutes). Each case opens on its first matching
-- signal and closes on the first one that does not match. Where the GPS database creates a case but hides it
-- because the vehicle is inside an authorized zone, these templates do not open it.

WITH seed (symptom_key, name, family, icon, description, source_key, spec) AS (VALUES
    ('risk-zone-stop', 'Detención en zona de riesgo', 'zones_places', 'STAY RISK', 'En viaje, detenido en una zona de riesgo entre 06:00 y 21:00',
     'gps_signal',
     '{"source":"gps_signal","activation":"signal.trip.active && signal.?derived.?moving == FALSE && signal.?geo.?risk_zone == TRUE && signal.local_minutes > 360.0 && signal.local_hour < 21","levels":[{"icu":1,"applies":true,"when":"held_s < 600","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"held_s >= 600 && held_s < 1500","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"held_s >= 1500 && held_s < 2400","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"held_s >= 2400","response":{"operator":true,"slaMinutes":10,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.normal_s >= 0"},"family":"zones_places","state":"OFF"}'),
    ('night-risk-stay', 'Pernoctación en zona de riesgo', 'zones_places', 'NIGHT STAY RISK', 'En viaje, detenido en una zona de riesgo entre 21:00 y 06:00',
     'gps_signal',
     '{"source":"gps_signal","activation":"signal.trip.active && signal.?derived.?moving == FALSE && signal.?geo.?risk_zone == TRUE && signal.?geo.?authorized_zone != TRUE && (signal.local_hour >= 21 || signal.local_hour < 6)","levels":[{"icu":1,"applies":true,"when":"held_s < 600","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"held_s >= 600 && held_s < 1200","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"held_s >= 1200 && held_s < 1800","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"held_s >= 1800","response":{"operator":true,"slaMinutes":10,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.normal_s >= 0"},"family":"zones_places","state":"OFF"}')
), definitions AS (
    INSERT INTO miot_symptoms.symptom_definition
        (tenant_code, symptom_key, name, family, icon, description, source_key, state, current_version,
         created_by, updated_by)
    SELECT '_platform', symptom_key, name, family, icon, description, source_key, 'OFF', '1.0.0',
           'platform-seed', 'platform-seed'
    FROM seed
    ON CONFLICT (tenant_code, symptom_key) DO NOTHING
    RETURNING id, symptom_key
)
INSERT INTO miot_symptoms.symptom_version
    (definition_id, tenant_code, version, status, spec, bump, reason, created_by, published_by, published_at)
SELECT d.id, '_platform', '1.0.0', 'PUBLISHED', s.spec::jsonb, 'MAJOR', 'Plantilla inicial de la plataforma',
       'platform-seed', 'platform-seed', now()
FROM definitions d JOIN seed s ON s.symptom_key = d.symptom_key;

-- Night stop and off-hours driving 2.0.0. Night stop reads outside_authorized, which counts a point inside an
-- authorized zone that overlaps another zone as outside, and skips trips with two drivers. Off-hours driving runs
-- from 01:30 to 06:00 with the level set by the clock (02:00, 02:30, 05:40) and level 4 after 45 min since the case
-- opened. After an operator closes a night-stop case, that symptom opens no other case on the same trip
-- (case.closed_on_trip), as the GPS database's respect_permanently_closed. Symptoms copied from 1.0.0 keep their
-- rules.

WITH upgrade (symptom_key, version, spec, bump, reason, description) AS (VALUES
    ('night-stop-unauthorized', '2.0.0',
     '{"source":"gps_signal","activation":"signal.trip.active && !signal.trip.double_driver && signal.?derived.?moving == FALSE && signal.?geo.?outside_authorized == TRUE && (signal.local_hour >= 21 || signal.local_hour < 6)","levels":[{"icu":1,"applies":true,"when":"held_s < 600","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"held_s >= 600 && held_s < 1200","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"held_s >= 1200 && held_s < 1800","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"held_s >= 1800","response":{"operator":true,"slaMinutes":10,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0 && !case.closed_on_trip","close":"case.normal_s >= 0"},"family":"zones_places","state":"OFF"}',
     'MAJOR', 'Escalamiento de la regla de pernoctación de la base GPS', 'En viaje con un conductor, detenido entre 21:00 y 06:00 fuera de toda zona autorizada'),
    ('off-hours-driving', '2.0.0',
     '{"source":"gps_signal","activation":"signal.trip.active && !signal.trip.double_driver && signal.?derived.?moving == TRUE && signal.?geo.?authorized_zone != TRUE && signal.local_minutes > 90.0 && signal.local_minutes < 360.0","levels":[{"icu":1,"applies":true,"when":"signal.local_minutes < 120.0","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"signal.local_minutes >= 120.0 && signal.local_minutes < 150.0 || signal.local_minutes >= 340.0","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"signal.local_minutes >= 150.0 && signal.local_minutes < 340.0 && open_s < 2700","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"signal.local_minutes >= 150.0 && signal.local_minutes < 340.0 && open_s >= 2700","response":{"operator":true,"slaMinutes":10,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.normal_s >= 0","levelDown":true},"family":"workday_fatigue","state":"OFF"}',
     'MAJOR', 'Escalamiento de la regla de movimiento en horario de la base GPS', 'En viaje con un conductor y en movimiento entre 01:30 y 06:00')
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

