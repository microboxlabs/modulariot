-- ============================================================
-- Propósito:  Migración V0.13.0 — schema miot_places
--             Capa geoespacial única de la organización: geocercas,
--             geocercas internas y trayectos, con versiones, vigencia
--             y puente a las geocercas de StreamHub.
-- BD/Esquema: miot / miot_places  (pruebas: miot_dev local)
-- Entorno:    db/migration/places (modulith)
-- Requisito:  extensión postgis, instalada por un administrador
-- Status:     draft
-- ============================================================
--
-- place guarda solo el estado vigente. Las versiones las escribe el
-- servicio, como en miot_symptoms (symptom_definition.current_version y
-- symptom_version): crear deja la 1.0.0 y cada edición pide su tamaño
-- (MAJOR, MINOR o PATCH) y una descripción, y deja una versión nueva.
-- Una geocerca y sus geocercas internas se versionan juntas: la versión
-- es de la geocerca y su foto lleva las internas.
--
-- geojson es un Feature GeoJSON, lo mismo que dibuja y edita el mapa.
-- Las coordenadas van [lon, lat].
--   Polygon     geocerca o geocerca interna. Un círculo se guarda ya
--               convertido a polígono, con properties.shape = 'circle',
--               properties.center [lon, lat] y properties.radius_m
--   LineString  trayecto
--
-- Correspondencia con StreamHub (prod_iot_gps.public.geofences):
--   tenant_code    ↔ client_id
--   external_code  ↔ client_geofence_id   (la llave con StreamHub, junto a tenant_code)
--   name           ↔ geofence_name
--   geojson        ↔ coordinates          (ST_AsGeoJSON / ST_GeomFromGeoJSON)
--   address        ↔ properties.address
--   categories     ↔ properties.category  (allá texto libre; acá, códigos de un seleccionable)
-- El geofence_id de StreamHub no se guarda: se busca por (client_id, client_geofence_id).
--
-- external_code: obligatorio en todo lugar (geocerca, geocerca interna y trayecto),
-- y único por organización entre los lugares vigentes, sin distinguir mayúsculas
-- ("SCL" y "scl" son el mismo). Borrar un lugar libera su código. El de una geocerca
-- o una interna no cambia una vez puesto (lo cuida el servicio); el de un trayecto
-- se puede editar, porque un trayecto solo se usa en Lugares.

-- categories: {"selectable": "categorias_lugar", "values": ["driving_safety"]}, los
-- códigos elegidos y el seleccionable donde buscar sus nombres. Un lugar usa un solo
-- seleccionable a la vez. Sin categorías es NULL, y no hay nada que buscar.

-- en prod la instala un administrador antes; ahí esto no hace nada
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS miot_places;

-- la hora de la escritura, no la del inicio de su transacción: una copia a StreamHub que se marcó mientras
-- tanto (synced_at) queda antes, y la edición sigue pendiente
CREATE OR REPLACE FUNCTION miot_places.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := clock_timestamp();
    RETURN NEW;
END $$;

CREATE TABLE miot_places.place (
    -- Base Data
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id       UUID,
    tenant_code     VARCHAR(128) NOT NULL,
    external_code   VARCHAR(128) NOT NULL, -- Ex: SCL. Único por organización (uq_place_code)
    -- Place Data
    name            VARCHAR(255) NOT NULL,
    icon            VARCHAR(64),
    color           VARCHAR(16),
    categories      JSONB,
    metadata        JSONB  NOT NULL DEFAULT '{}',
    address         TEXT,
    valid_from      TIMESTAMPTZ,
    valid_until     TIMESTAMPTZ,
    -- Shape data
    kind            VARCHAR(16)  NOT NULL CHECK (kind IN ('geofence','inner_geofence','route')),
    geojson         JSONB  NOT NULL,
    -- Versioning
    current_version VARCHAR(32),

    -- Time setting
    synced_at       TIMESTAMPTZ,                -- última copia a StreamHub
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(255),
    -- Logical deletion
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,   -- FALSE: eliminado (borrado lógico)
    -- geometría consultable, derivada siempre del geojson
    geom            geography GENERATED ALWAYS AS
                    (ST_GeomFromGeoJSON(geojson->'geometry')::geography) STORED,
    UNIQUE (id, tenant_code),
    FOREIGN KEY (parent_id, tenant_code) REFERENCES miot_places.place (id, tenant_code),
    CHECK (btrim(name) <> ''),
    -- el código no va vacío ni con espacios alrededor ("SCL" y " SCL" serían dos)
    CHECK (btrim(external_code) <> ''),
    CHECK (external_code = btrim(external_code)),
    -- solo una geocerca interna tiene padre; un trayecto nunca
    CHECK ((kind = 'inner_geofence') = (parent_id IS NOT NULL)),
    CHECK ((kind = 'inner_geofence') = (current_version IS NULL)),
    CHECK (current_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
    CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_from < valid_until),
    -- un CHECK que da NULL pasa: cada regla sobre el JSON termina en COALESCE(..., false)
    CHECK (jsonb_typeof(metadata) = 'object'),
    CHECK (categories IS NULL
           OR CASE WHEN jsonb_typeof(categories->'values') = 'array'
                   THEN jsonb_array_length(categories->'values') > 0
                        AND COALESCE(jsonb_typeof(categories->'selectable') = 'string'
                                     AND btrim(categories->>'selectable') <> '', false)
                   ELSE false END),
    CHECK (COALESCE(geojson->>'type' = 'Feature', false)),
    CHECK (COALESCE(jsonb_typeof(geojson->'properties') = 'object', false)),
    CHECK (COALESCE(geojson->'geometry'->>'type' IN ('Polygon','LineString'), false)),
    CHECK (COALESCE((kind = 'route') = (geojson->'geometry'->>'type' = 'LineString'), false)),
    -- una forma que se cruza a sí misma no sirve para "dentro / fuera"
    CHECK (COALESCE(ST_IsValid(geom::geometry), false)),
    -- un círculo trae su centro y su radio, para editarse como círculo
    CHECK (COALESCE(geojson->'properties'->>'shape' <> 'circle', true)
           OR (COALESCE(jsonb_typeof(geojson->'properties'->'center') = 'array', false)
               AND CASE WHEN jsonb_typeof(geojson->'properties'->'radius_m') = 'number'
                        THEN (geojson->'properties'->>'radius_m')::numeric > 0
                        ELSE false END))
);

-- el código no se repite entre los vigentes de la organización, como client_geofence_id
-- en StreamHub, y no distingue mayúsculas; borrar un lugar lo libera
CREATE UNIQUE INDEX uq_place_code ON miot_places.place (tenant_code, lower(external_code))
    WHERE is_active;
CREATE INDEX idx_place_tenant_kind ON miot_places.place (tenant_code, kind, name)
    WHERE is_active;
CREATE INDEX idx_place_parent ON miot_places.place (parent_id)
    WHERE parent_id IS NOT NULL AND is_active;
-- punto dentro de geocerca / cercanía
CREATE INDEX idx_place_geom ON miot_places.place USING gist (geom)
    WHERE is_active;
-- geocercas e internas pendientes de llevar a StreamHub (cada interna es una
-- geocerca propia allá, por su código): crear, editar y también eliminar.
-- El borrado lógico sube updated_at (trigger), así que la borrada pende igual
-- que la editada: el sync la elimina en StreamHub (borrado físico) y recién
-- ahí marca synced_at. Los trayectos no van a StreamHub.
CREATE INDEX idx_place_sync_pending ON miot_places.place (tenant_code)
    WHERE kind IN ('geofence', 'inner_geofence') AND (synced_at IS NULL OR synced_at < updated_at);

-- marcar synced_at no es una edición: no sube updated_at, que sigue diciendo
-- cuándo se editó el lugar
CREATE TRIGGER trg_place_updated_at BEFORE UPDATE ON miot_places.place
    FOR EACH ROW WHEN (NEW.synced_at IS NOT DISTINCT FROM OLD.synced_at)
    EXECUTE FUNCTION miot_places.set_updated_at();

-- Las versiones de una geocerca (con sus internas) o de un trayecto. Nunca se
-- editan: cada edición agrega una.
CREATE TABLE miot_places.place_version (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id        UUID         NOT NULL,
    tenant_code     VARCHAR(128) NOT NULL,
    version         VARCHAR(32)  NOT NULL CHECK (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
    bump            VARCHAR(8)   CHECK (bump IN ('MAJOR','MINOR','PATCH')),  -- NULL: la creación
    reason          TEXT,                       -- la descripción que escribió quien editó
    changes         JSONB        NOT NULL DEFAULT '[]',   -- qué cambió, en palabras
    snapshot        JSONB        NOT NULL,      -- el lugar como quedó, con sus geocercas internas
    created_by      VARCHAR(255) NOT NULL DEFAULT 'system',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    -- una versión es de un lugar de la misma organización
    FOREIGN KEY (place_id, tenant_code) REFERENCES miot_places.place (id, tenant_code),
    CHECK (bump IS NOT NULL OR version = '1.0.0'),
    CHECK (jsonb_typeof(changes) = 'array'),
    CHECK (jsonb_typeof(snapshot) = 'object')
);

CREATE UNIQUE INDEX uq_place_version_number ON miot_places.place_version (place_id, version);
CREATE INDEX idx_place_version_place ON miot_places.place_version (tenant_code, place_id, created_at);

-- Lectura para evaluadores: lo vigente y dentro de su ventana.
-- Lugares lee la tabla, porque necesita ver y renovar lo vencido.
CREATE VIEW miot_places.place_current AS
SELECT id, tenant_code, kind, parent_id, external_code, name, icon, color, address,
       categories, metadata, geojson, geom, valid_from, valid_until, current_version,
       created_at, updated_at
FROM miot_places.place
WHERE is_active
  AND (valid_from  IS NULL OR valid_from  <= now())
  AND (valid_until IS NULL OR valid_until >  now());
