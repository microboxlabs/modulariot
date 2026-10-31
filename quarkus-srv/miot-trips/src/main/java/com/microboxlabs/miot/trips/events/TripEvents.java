package com.microboxlabs.miot.trips.events;

import com.microboxlabs.miot.core.db.PgTx;
import com.microboxlabs.miot.core.event.EventContext;
import com.microboxlabs.miot.core.event.OperationalEvent;
import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.trips.domain.Assignment;
import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.domain.Mandate;
import com.microboxlabs.miot.trips.domain.MandateRef;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.store.AssignmentStore;
import com.microboxlabs.miot.trips.store.LocationStore;
import com.microboxlabs.miot.trips.store.MandateStore;
import com.microboxlabs.miot.trips.store.StageStore;
import com.microboxlabs.miot.trips.store.TripStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.inject.Inject;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.function.Function;
import java.util.function.UnaryOperator;
import org.jboss.logging.Logger;

/**
 * Publishes the {@code trip.*} events as {@link OperationalEvent}s once the transaction that caused them commits;
 * one rolled back publishes nothing. The context is {@code {kind: "trip", key: <trip id>}}. The trip part of the
 * data (service, route, times, plates) is read when the event is raised. A failure here never fails the change.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class TripEvents {

    private static final Logger LOG = Logger.getLogger(TripEvents.class);

    /** Publishes nothing. */
    public static final TripEvents NONE = new TripEvents((Function<OperationalEvent, CompletionStage<?>>) null,
            null, null, null, null, null, null);

    private final Function<OperationalEvent, CompletionStage<?>> fire;
    private final TripStore trips;
    private final StageStore stages;
    private final AssignmentStore assignments;
    private final LocationStore locations;
    private final MandateStore mandates;
    private final FleetResources fleet;

    @Inject
    TripEvents(Event<OperationalEvent> bus, TripStore trips, StageStore stages, AssignmentStore assignments,
            LocationStore locations, MandateStore mandates, FleetResources fleet) {
        this(bus::fireAsync, trips, stages, assignments, locations, mandates, fleet);
    }

    public TripEvents(Function<OperationalEvent, CompletionStage<?>> fire, TripStore trips, StageStore stages,
            AssignmentStore assignments, LocationStore locations, MandateStore mandates, FleetResources fleet) {
        this.fire = fire;
        this.trips = trips;
        this.stages = stages;
        this.assignments = assignments;
        this.locations = locations;
        this.mandates = mandates;
        this.fleet = fleet;
    }

    /** A rule of the trip's monitor raised {@code alert}. */
    public void alert(String tenantCode, String tripId, Instant at, String monitor, String alert, String rule) {
        publish(TripEventCatalog.ALERT, tenantCode, tripId, at, d -> d.alert(monitor, alert, rule));
    }

    /** The facts that distinguish one milestone event from the trip shared by all its events. */
    public record MilestoneNotice(String milestone, String source, Instant proposedAt, Instant confirmedAt,
            Instant otherAt, String channel, String actor, String rule) {
    }

    /** A milestone event: detected, confirmed, rejected or in conflict. */
    public void milestone(String type, String tenantCode, String tripId, Instant at, MilestoneNotice notice) {
        publish(type, tenantCode, tripId, at, d -> d.milestone(notice.milestone(), notice.source(),
                notice.proposedAt(), notice.confirmedAt(), notice.otherAt(), notice.channel(), notice.actor(),
                notice.rule()));
    }

    /** The feed changed {@code fields} on a closed trip. */
    public void closedChanged(String tenantCode, String tripId, Instant at, List<String> fields, String actor) {
        publish(TripEventCatalog.FEED_CLOSED_CHANGED, tenantCode, tripId, at, d -> d.changed(fields, actor));
    }

    private void publish(String type, String tenantCode, String tripId, Instant at,
            UnaryOperator<TripEventData> detail) {
        if (fire == null) {
            return;
        }
        TripEventData data;
        try {
            data = PgTx.savepoint(() -> detail.apply(summary(tenantCode, UUID.fromString(tripId))));
        } catch (RuntimeException e) {
            LOG.warnf("Trip event %s for trip %s not published: %s", type, tripId, e.getMessage());
            return;
        }
        OperationalEvent event = new OperationalEvent(type, TripEventCatalog.EVENT_SOURCE, tenantCode, at,
                new EventContext(TripEventCatalog.CONTEXT_KIND, tripId), data, false);
        PgTx.afterCommit(() -> fire.apply(event).exceptionally(e -> {
            LOG.warnf("Trip event %s for trip %s: an observer failed (%s)", type, tripId,
                    e.getClass().getSimpleName());
            return null;
        }));
    }

    /** The trip as people recognize it: its service, route, times and plates. */
    private TripEventData summary(String tenantCode, UUID tripId) {
        Trip trip = trips.find(tenantCode, tripId).orElseThrow(() -> new IllegalStateException("trip not found"));
        List<MandateRef> refs = trips.mandatesOf(tenantCode, tripId);
        MandateRef first = refs.isEmpty() ? null : refs.get(0);
        String orderRef = first == null ? null : mandates.find(tenantCode, UUID.fromString(first.mandateId()))
                .map(Mandate::orderRef).orElse(null);
        Instant plannedEnd = stages.listBySubject(tenantCode, Stage.SUBJECT_TRIP, tripId).stream()
                .map(Stage::plannedEnd).filter(Objects::nonNull).max(Comparator.naturalOrder())
                .map(OffsetDateTime::toInstant).orElse(null);
        List<Assignment> open = assignments.listByTrip(tenantCode, tripId).stream()
                .filter(a -> a.validTo() == null).toList();
        Optional<FleetResources.Carrier> carrier = carrier(tenantCode, open);
        return TripEventData.trip(trip.id(), first == null ? null : first.externalCode(), orderRef,
                place(tenantCode, trip.originId()), place(tenantCode, trip.destinationId()),
                trip.plannedStart() == null ? null : trip.plannedStart().toInstant(), plannedEnd,
                resource(tenantCode, open, Assignment.TRUCK), resource(tenantCode, open, Assignment.TRAILER),
                resource(tenantCode, open, Assignment.DRIVER), carrier.map(FleetResources.Carrier::legalName)
                        .orElse(null), carrier.map(FleetResources.Carrier::rut).map(TripEvents::rut).orElse(null));
    }

    /** The carrier of the truck assigned first. */
    private Optional<FleetResources.Carrier> carrier(String tenantCode, List<Assignment> open) {
        try {
            return open.stream().filter(a -> Assignment.TRUCK.equals(a.resourceType())).findFirst()
                    .flatMap(a -> fleet.vehicle(tenantCode, Assignment.TRUCK, UUID.fromString(a.resourceId())))
                    .map(FleetResources.Vehicle::carrierId)
                    .flatMap(id -> fleet.carrier(tenantCode, id));
        } catch (RuntimeException e) {
            return Optional.empty();
        }
    }

    /** "76.111.222-3" becomes "761112223", as contact books store a company's RUT. */
    static String rut(String raw) {
        String rut = raw.replaceAll("[.\\-\\s]", "").toUpperCase(java.util.Locale.ROOT);
        return rut.isEmpty() ? null : rut;
    }

    private String place(String tenantCode, String id) {
        if (id == null) {
            return null;
        }
        return locations.find(tenantCode, UUID.fromString(id)).map(Location::name).orElse(null);
    }

    /** The plate of the vehicle, or the document of the driver, assigned first. */
    private String resource(String tenantCode, List<Assignment> open, String type) {
        Optional<Assignment> a = open.stream().filter(x -> type.equals(x.resourceType())).findFirst();
        if (a.isEmpty()) {
            return null;
        }
        try {
            UUID id = UUID.fromString(a.get().resourceId());
            if (Assignment.DRIVER.equals(type)) {
                return fleet.driver(tenantCode, id).map(FleetResources.Driver::rut).orElse(null);
            }
            return fleet.vehicle(tenantCode, type, id).map(FleetResources.Vehicle::licensePlate).orElse(null);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** For tests: collects what would be fired. */
    public static TripEvents collecting(List<OperationalEvent> into, TripStore trips, StageStore stages,
            AssignmentStore assignments, LocationStore locations, MandateStore mandates, FleetResources fleet) {
        return new TripEvents(e -> {
            into.add(e);
            return CompletableFuture.completedFuture(null);
        }, trips, stages, assignments, locations, mandates, fleet);
    }
}
