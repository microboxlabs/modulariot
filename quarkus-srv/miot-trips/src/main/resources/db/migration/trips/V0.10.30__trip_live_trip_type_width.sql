-- trip_live.trip_type holds the primary mandate's order_type, which is VARCHAR(32).
ALTER TABLE miot_trips.trip_live ALTER COLUMN trip_type TYPE VARCHAR(32);
