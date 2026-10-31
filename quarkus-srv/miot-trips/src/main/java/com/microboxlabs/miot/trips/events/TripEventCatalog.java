package com.microboxlabs.miot.trips.events;

import com.microboxlabs.miot.core.event.EventTypeCatalog;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/** The trip events: alerts of the trip's monitor, milestones to confirm, and feed changes to closed trips. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class TripEventCatalog implements EventTypeCatalog {

    public static final String EVENT_SOURCE = "miot-trips";
    public static final String CONTEXT_KIND = "trip";
    public static final String ALERT = "trip.alert";
    public static final String MILESTONE_DETECTED = "trip.milestone.detected";
    public static final String MILESTONE_CONFIRMED = "trip.milestone.confirmed";
    public static final String MILESTONE_REJECTED = "trip.milestone.rejected";
    public static final String MILESTONE_CONFLICT = "trip.milestone.conflict";
    public static final String FEED_CLOSED_CHANGED = "trip.feed.closed_changed";

    private static final List<EventType> TYPES = List.of(
            new EventType(ALERT, "A rule of the trip's monitor raised an alert", TripEventData.class),
            new EventType(MILESTONE_DETECTED,
                    "A departure, arrival or closure was detected and waits for a person to confirm it",
                    TripEventData.class),
            new EventType(MILESTONE_CONFIRMED, "A person confirmed a departure, arrival or closure",
                    TripEventData.class),
            new EventType(MILESTONE_REJECTED, "A person rejected a detection as a false positive",
                    TripEventData.class),
            new EventType(MILESTONE_CONFLICT,
                    "A milestone already confirmed was confirmed again at another time", TripEventData.class),
            new EventType(FEED_CLOSED_CHANGED, "The feed changed a trip that is already closed; nothing was applied",
                    TripEventData.class));

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
