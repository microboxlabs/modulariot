ALTER TABLE miot_trips.feed_profile
    ADD COLUMN country VARCHAR(2),
    ADD CONSTRAINT feed_profile_country_check CHECK (country ~ '^[A-Z]{2}$');
