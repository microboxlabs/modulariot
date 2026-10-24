package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.trips.domain.CargoUnit;
import com.microboxlabs.miot.trips.domain.MandateRef;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.dto.AssignmentView;
import com.microboxlabs.miot.trips.dto.StageRequest;
import com.microboxlabs.miot.trips.dto.StageView;
import com.microboxlabs.miot.trips.dto.TripCargoView;
import com.microboxlabs.miot.trips.dto.TripRequest;
import com.microboxlabs.miot.trips.dto.TripView;
import com.microboxlabs.miot.trips.store.AssignmentStore;
import com.microboxlabs.miot.trips.store.CargoStore;
import com.microboxlabs.miot.trips.store.StageStore;
import com.microboxlabs.miot.trips.store.TripCargoStore;
import com.microboxlabs.miot.trips.store.TripFilter;
import com.microboxlabs.miot.trips.store.TripStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

/** Trips: the leg a carrier runs; it may serve several mandates (the convergence). */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class TripService {

    static final String ENTITY = "trip";
    private static final String MANDATE_IDS = "mandateIds";
    /** Stands in for the trip id while the stage plan is validated before the trip exists. */
    private static final UUID NO_TRIP = new UUID(0, 0);
    private static final String TRIP_NOT_FOUND = "trip not found";
    private static final String MANDATE_ID = "mandateId";

    private final TripStore trips;
    private final StageStore stages;
    private final AssignmentStore assignments;
    private final TripCargoStore tripCargo;
    private final CargoStore cargo;
    private final MandateService mandates;
    private final AuditService audit;
    private final Transactions tx;

    @Inject
    public TripService(TripStore trips, StageStore stages, AssignmentStore assignments,
            TripCargoStore tripCargo, CargoStore cargo, MandateService mandates, AuditService audit,
            Transactions tx) {
        this.trips = trips;
        this.stages = stages;
        this.assignments = assignments;
        this.tripCargo = tripCargo;
        this.cargo = cargo;
        this.mandates = mandates;
        this.audit = audit;
        this.tx = tx;
    }

    /** Creates the leg, links the given mandates and lays down the planned stages, in that order. */
    public TripView create(String tenantCode, String actor, TripRequest body) {
        return tx.inTransaction(() -> {
            TripRequest req = body == null ? TripRequest.empty() : body;
            // the whole request is validated before the first write
            List<UUID> mandateIds = req.mandateIds() == null ? List.of() : req.mandateIds().stream()
                    .map(m -> parse(Check.required(m, MANDATE_IDS, 64), MANDATE_IDS)).toList();
            if (req.stages() != null) {
                req.stages().forEach(s -> planned(tenantCode, actor, NO_TRIP, s));
            }
            Trip trip = trips.insert(new Trip(null, tenantCode, Trip.PLANNED,
                    Check.uuidOrNull(req.originId(), "originId"), Check.uuidOrNull(req.destinationId(), "destinationId"),
                    req.plannedStart(), null, null, null, null, actor, null, actor));
            UUID tripId = UUID.fromString(trip.id());
            // linked in id order (the order stage start locks them in), each keeping its request position
            List<Integer> order = new ArrayList<>(IntStream.range(0, mandateIds.size()).boxed().toList());
            order.sort(Comparator.comparing(mandateIds::get));
            for (int i : order) {
                mandates.requireOpen(tenantCode, mandateIds.get(i));
                trips.linkMandate(tenantCode, tripId, mandateIds.get(i), i + 1, "primary", actor);
            }
            if (req.stages() != null) {
                for (StageRequest s : req.stages()) {
                    stages.insert(planned(tenantCode, actor, tripId, s));
                }
            }
            audit.log(tenantCode, actor, "trip.created", ENTITY, trip.id(), trip.id(), Map.of());
            return detail(tenantCode, tripId);
        });
    }

    public Trip get(String tenantCode, UUID id) {
        return trips.find(tenantCode, id)
                .orElseThrow(() -> new NoSuchElementException(TRIP_NOT_FOUND));
    }

    /** The whole file of the trip: mandates, stages, assignments and cargo. */
    public TripView detail(String tenantCode, UUID id) {
        Trip trip = get(tenantCode, id);
        List<MandateRef> linked = trips.mandatesOf(tenantCode, id);
        List<StageView> stageViews = stages.listBySubject(tenantCode, Stage.SUBJECT_TRIP, id)
                .stream().map(StageView::of).toList();
        List<AssignmentView> assignmentViews = assignments.listByTrip(tenantCode, id)
                .stream().map(AssignmentView::of).toList();
        Map<String, CargoUnit> byId = cargo.listByTrip(tenantCode, id)
                .stream().collect(Collectors.toMap(CargoUnit::id, c -> c));
        List<TripCargoView> cargoViews = tripCargo.listByTrip(tenantCode, id)
                .stream().map(l -> TripCargoView.of(l, byId.get(l.cargoId()))).toList();
        return TripView.of(trip, linked, stageViews, assignmentViews, cargoViews);
    }

    public List<Trip> list(String tenantCode, TripFilter filter, Integer page, Integer size) {
        int p = page == null ? 0 : Math.max(page, 0);
        int s = size == null ? 50 : size;
        if (s < 1 || s > MandateService.MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("size must be between 1 and " + MandateService.MAX_PAGE_SIZE);
        }
        return trips.list(tenantCode, new TripFilter(Check.blankToNull(filter.status()), filter.mandateId(),
                Check.blankToNull(filter.assetId()), filter.from(), filter.to()), p, s);
    }

    /** Builds the list filter from query parameters; a blank mandateId does not filter. */
    public static TripFilter filter(String status, String mandateId, String assetId, OffsetDateTime from,
            OffsetDateTime to) {
        UUID mid = mandateId == null || mandateId.isBlank() ? null : parse(mandateId, MANDATE_ID);
        return new TripFilter(status, mid, assetId, from, to);
    }

    /** Patches the leg and planning; status moves through stages and cancel only. */
    public Trip update(String tenantCode, String actor, UUID id, TripRequest body) {
        return tx.inTransaction(() -> {
            TripRequest req = body == null ? TripRequest.empty() : body;
            Trip current = get(tenantCode, id);
            Trip updated = trips.update(new Trip(
                    current.id(), tenantCode, current.status(),
                    req.originId() == null ? current.originId() : Check.uuidOrNull(req.originId(), "originId"),
                    req.destinationId() == null ? current.destinationId() : Check.uuidOrNull(req.destinationId(), "destinationId"),
                    req.plannedStart() == null ? current.plannedStart() : req.plannedStart(),
                    current.actualStart(), current.actualEnd(), current.cancelReason(),
                    current.createdAt(), current.createdBy(), null, actor))
                    .orElseThrow(() -> new NoSuchElementException(TRIP_NOT_FOUND));
            audit.log(tenantCode, actor, "trip.updated", ENTITY, updated.id(), updated.id(), Map.of());
            return updated;
        });
    }

    public Trip cancel(String tenantCode, String actor, UUID id, String reason) {
        return tx.inTransaction(() -> {
            Trip current = get(tenantCode, id);
            if (Trip.DONE.equals(current.status()) || Trip.CANCELLED.equals(current.status())) {
                throw new IllegalStateException("trip already " + current.status());
            }
            String why = Check.required(reason, "reason", 500);
            Trip cancelled = trips.update(new Trip(
                    current.id(), tenantCode, Trip.CANCELLED,
                    current.originId(), current.destinationId(), current.plannedStart(),
                    current.actualStart(), OffsetDateTime.now(ZoneOffset.UTC), why,
                    current.createdAt(), current.createdBy(), null, actor))
                    .orElseThrow(() -> new NoSuchElementException(TRIP_NOT_FOUND));
            audit.log(tenantCode, actor, "trip.cancelled", ENTITY, cancelled.id(), cancelled.id(),
                    Map.of("reason", why));
            return cancelled;
        });
    }

    /** Links a mandate — the convergence. Returns false when the link already existed. */
    public boolean linkMandate(String tenantCode, String actor, UUID tripId, String mandateId, Integer seq,
            String role) {
        return tx.inTransaction(() -> {
            get(tenantCode, tripId);
            UUID mid = parse(Check.required(mandateId, MANDATE_ID, 64), MANDATE_ID);
            List<MandateRef> current = trips.mandatesOf(tenantCode, tripId);
            // an existing link stays a no-op, even once its mandate has closed
            if (current.stream().anyMatch(m -> m.mandateId().equals(mid.toString()))) {
                return false;
            }
            int s = seq == null ? current.size() + 1 : seq;
            String r = role == null || role.isBlank() ? "primary" : Check.limited(role, "role", 32);
            mandates.requireOpen(tenantCode, mid);
            boolean linked = trips.linkMandate(tenantCode, tripId, mid, s, r, actor);
            if (linked) {
                audit.log(tenantCode, actor, "trip.mandate_linked", ENTITY, tripId.toString(), tripId.toString(),
                        Map.of(MANDATE_ID, mid.toString()));
            }
            return linked;
        });
    }

    /** Unlinks; refused while cargo of that mandate rides on the trip. */
    public void unlinkMandate(String tenantCode, String actor, UUID tripId, UUID mandateId) {
        tx.inTransaction(() -> {
            get(tenantCode, tripId);
            int onBoard = trips.cargoOfMandateOnTrip(tenantCode, tripId, mandateId);
            if (onBoard > 0) {
                throw new IllegalStateException(onBoard + " cargo unit(s) of that mandate ride on the trip");
            }
            if (!trips.unlinkMandate(tenantCode, tripId, mandateId)) {
                throw new NoSuchElementException("link not found");
            }
            audit.log(tenantCode, actor, "trip.mandate_unlinked", ENTITY, tripId.toString(), tripId.toString(),
                    Map.of(MANDATE_ID, mandateId.toString()));
        });
    }

    public List<MandateRef> mandatesOf(String tenantCode, UUID tripId) {
        return trips.mandatesOf(tenantCode, tripId);
    }

    private static Stage planned(String tenantCode, String actor, UUID tripId, StageRequest s) {
        String type = Check.oneOf(Check.required(s.stageType(), "stageType", 32), "stageType",
                "preparacion", "carga", "transito", "parada", "descarga", "cierre");
        return new Stage(null, tenantCode, Stage.SUBJECT_TRIP, tripId.toString(), 0, type,
                Check.limitedOrNull(s.serviceStatus(), "serviceStatus", 64), Stage.PENDING,
                Check.uuidOrNull(s.locationId(), "locationId"), s.plannedStart(), s.plannedEnd(), null, null,
                s.checklist() == null ? null : s.checklist().toString(), null, actor, null, actor);
    }

    static UUID parse(String raw, String field) {
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(field + " must be a UUID");
        }
    }
}
