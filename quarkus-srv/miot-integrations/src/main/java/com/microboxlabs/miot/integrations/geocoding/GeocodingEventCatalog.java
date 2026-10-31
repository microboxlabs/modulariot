package com.microboxlabs.miot.integrations.geocoding;

import com.microboxlabs.miot.core.event.EventTypeCatalog;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/** The geocoding events: an organization reached the alert share of its monthly quota. */
@ApplicationScoped
public class GeocodingEventCatalog implements EventTypeCatalog {

    public static final String EVENT_SOURCE = "miot-integrations";
    public static final String CONTEXT_KIND = "geocoding_quota";
    public static final String QUOTA_THRESHOLD = "geocoding.quota.threshold";

    private static final List<EventType> TYPES = List.of(new EventType(QUOTA_THRESHOLD,
            "The organization used the alert share of its monthly geocoding quota", GeocodingQuotaData.class));

    @Override
    public String source() {
        return EVENT_SOURCE;
    }

    @Override
    public String contextKind() {
        return CONTEXT_KIND;
    }

    @Override
    public List<EventType> types() {
        return TYPES;
    }
}
