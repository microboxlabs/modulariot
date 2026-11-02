package com.microboxlabs.miot.integrations.geocoding;

import com.microboxlabs.miot.core.auth.PlatformScope;
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
 * Publishes the {@code geocoding.*} events as {@link OperationalEvent}s, which communication rules turn into
 * messages. Each event goes to the organization's tenant, for its own rules, and to the platform's, for the
 * platform owners' rules. The context is {@code {kind: "geocoding_quota", key: <organization>}}. A failure never
 * fails the call.
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

    /** {@code type} is {@link GeocodingEventCatalog#QUOTA_THRESHOLD} or {@link GeocodingEventCatalog#QUOTA_EXHAUSTED}. */
    public void quota(String type, String tenantCode, GeocodingQuotaData data) {
        Instant at = Instant.now();
        if (tenantCode != null && !PlatformScope.TENANT.equals(tenantCode)) {
            publish(type, tenantCode, at, data);
        }
        publish(type, PlatformScope.TENANT, at, data);
    }

    private void publish(String type, String tenantCode, Instant at, GeocodingQuotaData data) {
        OperationalEvent event = new OperationalEvent(type, GeocodingEventCatalog.EVENT_SOURCE, tenantCode, at,
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
