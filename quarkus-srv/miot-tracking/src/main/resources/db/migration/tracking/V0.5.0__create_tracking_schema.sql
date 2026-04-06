-- Tracking persistence schema
CREATE SCHEMA IF NOT EXISTS miot_tracking;

-- Required extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS partman;
CREATE EXTENSION IF NOT EXISTS pg_partman WITH SCHEMA partman;
