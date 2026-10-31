package com.microboxlabs.miot.integrations.geocoding;

import com.microboxlabs.miot.core.event.EventContext;
import com.microboxlabs.miot.core.event.OperationalEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.concurrent.CompletionStage;
import java.util.function.Function;
import org.jboss.logging.Logger;

/**
 * Publishes the {@code geocoding.*} events as {@link OperationalEvent}s, which conversation rules can turn into a
 * message. The context is {@code {kind: "geocoding_quota", key: <organization>}}. A failure never fails the call.
 */
@ApplicationScoped
public class GeocodingEvents {

    private static final Logger LOG = Logger.getLogger(GeocodingEvents.class);

    private final Function<OperationalEvent, CompletionStage<?>> fire;

    @Inject
    GeocodingEvents(Event<OperationalEvent> bus) {
        this(bus::fireAsync);
    }

    public GeocodingEvents(Function<OperationalEvent, CompletionStage<?>> fire) {
        this.fire = fire;
    }

    public void quotaThreshold(String tenantCode, GeocodingQuotaData data) {
        quotaLevel(tenantCode, data, GeocodingQuotaNotification.THRESHOLD);
    }

    public void quotaLevel(String tenantCode, GeocodingQuotaData data, String level) {
        String type = GeocodingQuotaNotification.EXHAUSTED.equals(level)
                ? GeocodingEventCatalog.QUOTA_EXHAUSTED : GeocodingEventCatalog.QUOTA_THRESHOLD;
        OperationalEvent event = new OperationalEvent(type,
                GeocodingEventCatalog.EVENT_SOURCE, tenantCode, Instant.now(),
                new EventContext(GeocodingEventCatalog.CONTEXT_KIND, data.organization()), data, false);
        try {
            fire.apply(event).exceptionally(e -> {
                LOG.warnf("Geocoding event %s for %s: an observer failed (%s)", event.type(), data.organization(),
                        e.getClass().getSimpleName());
                return null;
            });
        } catch (RuntimeException e) {
            LOG.warnf("Geocoding event %s for %s not published: %s", event.type(), data.organization(),
                    e.getMessage());
        }
    }
}
