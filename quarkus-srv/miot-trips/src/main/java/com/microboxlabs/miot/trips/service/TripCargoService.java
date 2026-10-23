package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.trips.domain.CargoUnit;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.domain.TripCargoLink;
import com.microboxlabs.miot.trips.dto.TripCargoRequest;
import com.microboxlabs.miot.trips.store.CargoStore;
import com.microboxlabs.miot.trips.store.StageStore;
import com.microboxlabs.miot.trips.store.TripCargoStore;
import com.microboxlabs.miot.trips.store.TripStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;

/**
 * Mounting cargo on a trip — the physical link. A DB trigger keeps the contractual
 * side consistent: the mandate that owns the cargo gets linked to the trip.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class TripCargoService {

    static final String ENTITY = "trip_cargo";

    private final TripCargoStore store;
    private final TripStore trips;
    private final CargoStore cargo;
    private final StageStore stages;
    private final AuditService audit;

    @Inject
    public TripCargoService(TripCargoStore store, TripStore trips, CargoStore cargo, StageStore stages,
            AuditService audit) {
        this.store = store;
        this.trips = trips;
        this.cargo = cargo;
        this.stages = stages;
        this.audit = audit;
    }

    public TripCargoLink mount(String tenantCode, String actor, UUID tripId, TripCargoRequest body) {
        if (body == null) {
            throw new IllegalArgumentException("body is required");
        }
        Trip trip = trips.find(tenantCode, tripId)
                .orElseThrow(() -> new NoSuchElementException("trip not found"));
        if (Trip.DONE.equals(trip.status()) || Trip.CANCELLED.equals(trip.status())) {
            throw new IllegalStateException("trip already " + trip.status());
        }
        UUID cargoId = TripService.parse(Check.required(body.cargoId(), "cargoId", 64), "cargoId");
        cargo.find(tenantCode, cargoId)
                .orElseThrow(() -> new NoSuchElementException("cargo not found"));
        TripCargoLink mounted = store.insert(new TripCargoLink(tripId.toString(), cargoId.toString(), tenantCode,
                stageOf(tenantCode, tripId, body.loadStageId(), "loadStageId"),
                stageOf(tenantCode, tripId, body.unloadStageId(), "unloadStageId"),
                null, actor, null, actor))
                .orElseThrow(() -> new IllegalStateException("cargo already mounted on this trip"));
        audit.log(tenantCode, actor, "trip_cargo.mounted", ENTITY, cargoId.toString(), tripId.toString(),
                Map.of());
        return mounted;
    }

    /** Sets at which stages the cargo loads and unloads. */
    public TripCargoLink setStages(String tenantCode, String actor, UUID tripId, UUID cargoId,
            TripCargoRequest body) {
        TripCargoRequest req = body == null ? new TripCargoRequest(null, null, null) : body;
        TripCargoLink current = store.find(tenantCode, tripId, cargoId)
                .orElseThrow(() -> new NoSuchElementException("link not found"));
        TripCargoLink updated = store.update(new TripCargoLink(
                current.tripId(), current.cargoId(), tenantCode,
                req.loadStageId() == null ? current.loadedAtStage()
                        : stageOf(tenantCode, tripId, req.loadStageId(), "loadStageId"),
                req.unloadStageId() == null ? current.unloadedAtStage()
                        : stageOf(tenantCode, tripId, req.unloadStageId(), "unloadStageId"),
                current.createdAt(), current.createdBy(), null, actor))
                .orElseThrow(() -> new NoSuchElementException("link not found"));
        audit.log(tenantCode, actor, "trip_cargo.stages_set", ENTITY, cargoId.toString(), tripId.toString(),
                Map.of());
        return updated;
    }

    /** Unmounts; refused once the cargo was picked up. */
    public void unmount(String tenantCode, String actor, UUID tripId, UUID cargoId) {
        store.find(tenantCode, tripId, cargoId)
                .orElseThrow(() -> new NoSuchElementException("link not found"));
        CargoUnit unit = cargo.find(tenantCode, cargoId)
                .orElseThrow(() -> new NoSuchElementException("cargo not found"));
        if (CargoUnit.PICKED.equals(unit.status()) || CargoUnit.DELIVERED.equals(unit.status())
                || CargoUnit.RECEIVED.equals(unit.status())) {
            throw new IllegalStateException("cargo already " + unit.status());
        }
        store.delete(tenantCode, tripId, cargoId);
        audit.log(tenantCode, actor, "trip_cargo.unmounted", ENTITY, cargoId.toString(), tripId.toString(),
                Map.of());
    }

    /** A load or unload stage must be a stage of this trip; closing it moves the cargo. */
    private String stageOf(String tenantCode, UUID tripId, String raw, String field) {
        String id = Check.uuidOrNull(raw, field);
        if (id == null) {
            return null;
        }
        Stage stage = stages.find(tenantCode, UUID.fromString(id))
                .orElseThrow(() -> new IllegalArgumentException(field + " does not exist"));
        if (!Stage.SUBJECT_TRIP.equals(stage.subjectType()) || !tripId.toString().equals(stage.subjectId())) {
            throw new IllegalArgumentException(field + " is not a stage of this trip");
        }
        return id;
    }
}
