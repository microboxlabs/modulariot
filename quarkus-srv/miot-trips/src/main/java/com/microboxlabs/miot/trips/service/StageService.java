package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.trips.domain.MandateRef;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.StageActivity;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.dto.ActivityRequest;
import com.microboxlabs.miot.trips.dto.StageRequest;
import com.microboxlabs.miot.trips.store.StageStore;
import com.microboxlabs.miot.trips.store.TripCargoStore;
import com.microboxlabs.miot.trips.store.TripStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

/**
 * Stages ARE the state machine of a trip: starting one is the state change (only
 * one runs at a time), closing one moves the cargo it loads or unloads, and the
 * closing stage of type 'closing' realizes the trip.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class StageService {

    static final String ENTITY = "stage";
    static final String ACTIVITY_ENTITY = "stage_activity";
    private static final String STAGE_TYPE = "stageType";
    private static final String CLOSING = "closing";
    private static final String ACTIVITY_NOT_FOUND = "activity not found";

    private final StageStore stages;
    private final TripStore trips;
    private final TripCargoStore tripCargo;
    private final MandateService mandates;
    private final TripLiveProjector live;
    private final AuditService audit;
    private final Transactions tx;

    @Inject
    public StageService(StageStore stages, TripStore trips, TripCargoStore tripCargo,
            MandateService mandates, TripLiveProjector live, AuditService audit, Transactions tx) {
        this.stages = stages;
        this.trips = trips;
        this.tripCargo = tripCargo;
        this.mandates = mandates;
        this.live = live;
        this.audit = audit;
        this.tx = tx;
    }

    public List<Stage> listByTrip(String tenantCode, UUID tripId) {
        trips.find(tenantCode, tripId).orElseThrow(() -> new NoSuchElementException("trip not found"));
        return stages.listBySubject(tenantCode, Stage.SUBJECT_TRIP, tripId);
    }

    public Stage get(String tenantCode, UUID id) {
        return stages.find(tenantCode, id)
                .orElseThrow(() -> new NoSuchElementException("stage not found"));
    }

    /** Adds a planned stage at the end of the trip's sequence. */
    public Stage add(String tenantCode, String actor, UUID tripId, StageRequest body) {
        return tx.inTransaction(() -> {
            StageRequest req = body == null ? StageRequest.empty() : body;
            Trip trip = trips.find(tenantCode, tripId)
                    .orElseThrow(() -> new NoSuchElementException("trip not found"));
            if (Trip.DONE.equals(trip.status()) || Trip.CANCELLED.equals(trip.status())) {
                throw new IllegalStateException("trip already " + trip.status());
            }
            String type = Check.oneOf(Check.required(req.stageType(), STAGE_TYPE, 32), STAGE_TYPE,
                    "preparation", "loading", "transit", "stop", "unloading", CLOSING);
            Stage created = stages.insert(new Stage(null, tenantCode, Stage.SUBJECT_TRIP, tripId.toString(), 0,
                    type, Check.limitedOrNull(req.serviceStatus(), "serviceStatus", 64),
                    Stage.PENDING, Check.uuidOrNull(req.locationId(), "locationId"),
                    req.plannedStart(), req.plannedEnd(), null, null,
                    req.checklist() == null ? null : req.checklist().toString(), null, actor, null, actor));
            live.refresh(tenantCode, tripId);
            audit.log(tenantCode, actor, "stage.added", ENTITY, created.id(), tripId.toString(),
                    Map.of(STAGE_TYPE, type));
            return created;
        });
    }

    /** Patches the plan of a stage that has not started. */
    public Stage update(String tenantCode, String actor, UUID id, StageRequest body) {
        Stage subject = get(tenantCode, id);
        return tx.inTransaction(() -> {
            lockTrip(tenantCode, subject);
            StageRequest req = body == null ? StageRequest.empty() : body;
            Stage current = get(tenantCode, id);
            if (!Stage.PENDING.equals(current.status())) {
                throw new IllegalStateException("only pending stages can be re-planned");
            }
            String type = req.stageType() == null ? current.stageType()
                    : Check.oneOf(req.stageType(), STAGE_TYPE,
                            "preparation", "loading", "transit", "stop", "unloading", CLOSING);
            Stage updated = stages.update(new Stage(
                    current.id(), tenantCode, current.subjectType(), current.subjectId(), current.seq(),
                    type, Check.orKeep(req.serviceStatus(), current.serviceStatus(), "serviceStatus", 64),
                    current.status(),
                    req.locationId() == null ? current.locationId() : Check.uuidOrNull(req.locationId(), "locationId"),
                    req.plannedStart() == null ? current.plannedStart() : req.plannedStart(),
                    req.plannedEnd() == null ? current.plannedEnd() : req.plannedEnd(),
                    null, null,
                    req.checklist() == null ? current.checklist() : req.checklist().toString(),
                    current.createdAt(), current.createdBy(), null, actor))
                    .orElseThrow(() -> new NoSuchElementException("stage not found"));
            refreshTrip(tenantCode, updated);
            audit.log(tenantCode, actor, "stage.updated", ENTITY, updated.id(), updated.subjectId(), Map.of());
            return updated;
        });
    }

    /** Opens the stage — THE state change. 409 while another stage of the subject runs. */
    public Stage start(String tenantCode, String actor, UUID id) {
        return start(tenantCode, actor, id, null);
    }

    /** Opens the stage at {@code at}, the time it actually started; null is now. */
    public Stage start(String tenantCode, String actor, UUID id, OffsetDateTime at) {
        Stage subject = get(tenantCode, id);
        return tx.inTransaction(() -> {
            requireOpenTrip(tenantCode, subject);
            Stage current = get(tenantCode, id);
            if (!Stage.PENDING.equals(current.status())) {
                throw new IllegalStateException("stage is " + current.status());
            }
            OffsetDateTime now = at == null ? OffsetDateTime.now(ZoneOffset.UTC) : at.withOffsetSameInstant(
                    ZoneOffset.UTC);
            Stage started = stages.start(tenantCode, id, now, actor)
                    .orElseThrow(() -> new IllegalStateException("stage is no longer pending"));
            onTripStageStarted(tenantCode, actor, started, now);
            refreshTrip(tenantCode, started);
            audit.log(tenantCode, actor, "stage.started", ENTITY, started.id(), started.subjectId(),
                    Map.of(STAGE_TYPE, started.stageType()));
            return started;
        });
    }

    /** Closes the stage; moves the cargo it loads/unloads, and 'closing' realizes the trip. */
    public Stage close(String tenantCode, String actor, UUID id) {
        return close(tenantCode, actor, id, null);
    }

    /** Closes the stage at {@code at}, the time it actually ended; null is now. */
    public Stage close(String tenantCode, String actor, UUID id, OffsetDateTime at) {
        Stage subject = get(tenantCode, id);
        return tx.inTransaction(() -> {
            requireOpenTrip(tenantCode, subject);
            Stage current = get(tenantCode, id);
            if (!Stage.RUNNING.equals(current.status())) {
                throw new IllegalStateException("stage is " + current.status());
            }
            OffsetDateTime now = at == null ? OffsetDateTime.now(ZoneOffset.UTC) : at.withOffsetSameInstant(
                    ZoneOffset.UTC);
            Stage closed = stages.close(tenantCode, id, now, actor)
                    .orElseThrow(() -> new IllegalStateException("stage is no longer in_progress"));
            int loaded = tripCargo.markLoadedByStage(tenantCode, id, actor);
            int delivered = tripCargo.markDeliveredByStage(tenantCode, id, actor);
            if (CLOSING.equals(closed.stageType())) {
                onTripRealized(tenantCode, actor, closed, now);
            }
            refreshTrip(tenantCode, closed);
            audit.log(tenantCode, actor, "stage.closed", ENTITY, closed.id(), closed.subjectId(),
                    Map.of(STAGE_TYPE, closed.stageType(), "cargoLoaded", loaded, "cargoDelivered", delivered));
            return closed;
        });
    }

    public List<StageActivity> listActivities(String tenantCode, UUID stageId) {
        get(tenantCode, stageId);
        return stages.listActivities(tenantCode, stageId);
    }

    public StageActivity getActivity(String tenantCode, UUID id) {
        return stages.findActivity(tenantCode, id)
                .orElseThrow(() -> new NoSuchElementException(ACTIVITY_NOT_FOUND));
    }

    public StageActivity addActivity(String tenantCode, String actor, UUID stageId, ActivityRequest body) {
        return tx.inTransaction(() -> {
            ActivityRequest req = body == null ? ActivityRequest.empty() : body;
            Stage stage = get(tenantCode, stageId);
            if (Stage.CLOSED.equals(stage.status())) {
                throw new IllegalStateException("stage already closed");
            }
            String type = Check.required(req.activityType(), "activityType", 64);
            StageActivity created = stages.insertActivity(new StageActivity(null, tenantCode, stageId.toString(), 0,
                    type, StageActivity.PENDING, Check.limitedOrNull(req.assignee(), "assignee", 255), null,
                    req.evidence() == null ? null : req.evidence().toString(), null, null, actor, null, actor));
            audit.log(tenantCode, actor, "activity.added", ACTIVITY_ENTITY, created.id(), stage.subjectId(),
                    Map.of("activityType", type));
            return created;
        });
    }

    public StageActivity updateActivity(String tenantCode, String actor, UUID id, ActivityRequest body) {
        return tx.inTransaction(() -> {
            ActivityRequest req = body == null ? ActivityRequest.empty() : body;
            StageActivity current = getActivity(tenantCode, id);
            String status = req.status() == null ? current.status()
                    : Check.oneOf(req.status(), "status", StageActivity.PENDING, StageActivity.RUNNING,
                            StageActivity.DONE, StageActivity.NOT_APPLICABLE);
            StageActivity updated = stages.updateActivity(new StageActivity(
                    current.id(), tenantCode, current.stageId(), current.seq(), current.activityType(), status,
                    Check.orKeep(req.assignee(), current.assignee(), "assignee", 255), current.assignmentId(),
                    req.evidence() == null ? current.evidence() : req.evidence().toString(),
                    StageActivity.DONE.equals(status) && current.doneAt() == null
                            ? OffsetDateTime.now(ZoneOffset.UTC) : current.doneAt(),
                    current.createdAt(), current.createdBy(), null, actor))
                    .orElseThrow(() -> new NoSuchElementException(ACTIVITY_NOT_FOUND));
            audit.log(tenantCode, actor, "activity.updated", ACTIVITY_ENTITY, updated.id(), null, Map.of());
            return updated;
        });
    }

    /** Marks the activity done; the assignment it produces (if any) is created by the caller. */
    public StageActivity completeActivity(String tenantCode, String actor, UUID id, String evidence,
            String assignmentId) {
        return tx.inTransaction(() -> {
            StageActivity current = getActivity(tenantCode, id);
            if (StageActivity.DONE.equals(current.status())) {
                throw new IllegalStateException("activity already done");
            }
            StageActivity done = stages.updateActivity(new StageActivity(
                    current.id(), tenantCode, current.stageId(), current.seq(), current.activityType(),
                    StageActivity.DONE, current.assignee(),
                    assignmentId == null ? current.assignmentId() : Check.uuidOrNull(assignmentId, "assignmentId"),
                    evidence == null ? current.evidence() : evidence,
                    OffsetDateTime.now(ZoneOffset.UTC),
                    current.createdAt(), current.createdBy(), null, actor))
                    .orElseThrow(() -> new NoSuchElementException(ACTIVITY_NOT_FOUND));
            audit.log(tenantCode, actor, "activity.completed", ACTIVITY_ENTITY, done.id(), null, Map.of());
            return done;
        });
    }

    private void refreshTrip(String tenantCode, Stage stage) {
        if (Stage.SUBJECT_TRIP.equals(stage.subjectType())) {
            live.refresh(tenantCode, UUID.fromString(stage.subjectId()));
        }
    }

    /** Locks the stage's trip, so every operation that takes several locks takes the trip's first. */
    private Optional<Trip> lockTrip(String tenantCode, Stage stage) {
        if (!Stage.SUBJECT_TRIP.equals(stage.subjectType())) {
            return Optional.empty();
        }
        return trips.find(tenantCode, UUID.fromString(stage.subjectId()));
    }

    private void requireOpenTrip(String tenantCode, Stage stage) {
        lockTrip(tenantCode, stage)
                .filter(t -> Trip.DONE.equals(t.status()) || Trip.CANCELLED.equals(t.status()))
                .ifPresent(t -> {
                    throw new IllegalStateException("trip already " + t.status());
                });
    }

    /** The first running stage puts the trip and its mandates in_progress. */
    private void onTripStageStarted(String tenantCode, String actor, Stage started, OffsetDateTime now) {
        if (!Stage.SUBJECT_TRIP.equals(started.subjectType())) {
            return;
        }
        UUID tripId = UUID.fromString(started.subjectId());
        trips.find(tenantCode, tripId)
                .filter(t -> Trip.PLANNED.equals(t.status()))
                .ifPresent(t -> {
                    trips.update(new Trip(t.id(), tenantCode, Trip.IN_PROGRESS, t.originId(), t.destinationId(),
                            t.plannedStart(), now, t.actualEnd(), t.cancelReason(),
                            t.createdAt(), t.createdBy(), null, actor));
                    // mandates are locked in id order, so trips sharing mandates cannot deadlock
                    for (MandateRef m : trips.mandatesOf(tenantCode, tripId).stream()
                            .sorted(Comparator.comparing(MandateRef::mandateId)).toList()) {
                        mandates.markRunning(tenantCode, actor, UUID.fromString(m.mandateId()));
                    }
                });
    }

    private void onTripRealized(String tenantCode, String actor, Stage closed, OffsetDateTime now) {
        if (!Stage.SUBJECT_TRIP.equals(closed.subjectType())) {
            return;
        }
        UUID tripId = UUID.fromString(closed.subjectId());
        trips.find(tenantCode, tripId)
                .filter(t -> !Trip.DONE.equals(t.status()) && !Trip.CANCELLED.equals(t.status()))
                .ifPresent(t -> trips.update(new Trip(t.id(), tenantCode, Trip.DONE,
                        t.originId(), t.destinationId(), t.plannedStart(),
                        t.actualStart() == null ? now : t.actualStart(), now, t.cancelReason(),
                        t.createdAt(), t.createdBy(), null, actor)));
    }
}
