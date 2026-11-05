package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.trips.domain.Assignment;
import com.microboxlabs.miot.trips.domain.AuditEvent;
import com.microboxlabs.miot.trips.domain.CargoUnit;
import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.domain.Mandate;
import com.microboxlabs.miot.trips.domain.MandateLine;
import com.microboxlabs.miot.trips.domain.MandateRef;
import com.microboxlabs.miot.trips.domain.PendingMilestone;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.StageActivity;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.domain.TripCargoLink;
import com.microboxlabs.miot.trips.domain.TripLiveProjection;
import com.microboxlabs.miot.trips.domain.TripLiveRow;
import com.microboxlabs.miot.trips.domain.TripMilestone;
import com.microboxlabs.miot.trips.domain.TripRef;
import com.microboxlabs.miot.trips.service.TripLiveProjector;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

/**
 * One in-memory copy of the miot_trips schema for service tests: the mandate's line,
 * cargo partial numbering, stage sequence and the one-running-stage rule.
 * Each store is a view over the same shared state.
 */
public class InMemoryTripsWorld {

    private final Map<String, Mandate> mandates = new LinkedHashMap<>();
    private final Map<String, MandateLine> linesByMandate = new LinkedHashMap<>();
    private final Map<String, CargoUnit> cargo = new LinkedHashMap<>();
    private final Map<String, Trip> trips = new LinkedHashMap<>();
    private final Map<String, List<MandateRef>> tripMandates = new LinkedHashMap<>();
    private final Map<String, Stage> stages = new LinkedHashMap<>();
    private final Map<String, StageActivity> activities = new LinkedHashMap<>();
    private final Map<String, Assignment> assignments = new LinkedHashMap<>();
    private final Map<String, TripCargoLink> tripCargo = new LinkedHashMap<>();
    private final Map<String, Location> locations = new LinkedHashMap<>();
    private final Map<String, TripLiveProjection> live = new LinkedHashMap<>();
    private final Map<String, TripMilestone> milestones = new LinkedHashMap<>();
    private final List<AuditEvent> audit = new ArrayList<>();
    private final AtomicLong auditSeq = new AtomicLong();

    public final MandateStore mandateStore = new Mandates();
    public final CargoStore cargoStore = new Cargos();
    public final TripStore tripStore = new Trips();
    public final StageStore stageStore = new Stages();
    public final AssignmentStore assignmentStore = new Assignments();
    public final TripCargoStore tripCargoStore = new TripCargos();
    public final AuditStore auditStore = new Audits();
    public final LocationStore locationStore = new Locations();
    public final TripLiveStore tripLiveStore = new Lives();
    public final MilestoneStore milestoneStore = new Milestones();

    private static OffsetDateTime now() {
        return OffsetDateTime.now(ZoneOffset.UTC);
    }

    private static String newId() {
        return UUID.randomUUID().toString();
    }

    /** The projector over this world's stores. */
    public TripLiveProjector projector(FleetResources fleet) {
        return new TripLiveProjector(tripStore, stageStore, assignmentStore, cargoStore, locationStore, tripLiveStore,
                fleet);
    }

    public List<AuditEvent> auditTrail() {
        return List.copyOf(audit);
    }

    private class Mandates implements MandateStore {

        @Override
        public CreateOrGet insertOrGet(Mandate m) {
            Optional<Mandate> existing = findByCode(m.tenantCode(), m.externalCode());
            if (existing.isPresent()) {
                return new CreateOrGet(existing.get(), false);
            }
            Mandate created = new Mandate(newId(), m.tenantCode(), m.externalCode(), m.orderType(),
                    m.orderRef(), m.status(), m.originId(), m.destinationId(), m.slaMinutes(), m.closedAt(),
                    m.cancelReason(), now(), m.createdBy(), now(), m.updatedBy());
            mandates.put(created.id(), created);
            linesByMandate.put(created.id(),
                    new MandateLine(newId(), created.tenantCode(), created.id(), 1, null));
            return new CreateOrGet(created, true);
        }

        @Override
        public Optional<Mandate> find(String tenantCode, UUID id) {
            return Optional.ofNullable(mandates.get(id.toString()))
                    .filter(m -> m.tenantCode().equals(tenantCode));
        }

        @Override
        public Optional<Mandate> findByCode(String tenantCode, String externalCode) {
            return mandates.values().stream()
                    .filter(m -> m.tenantCode().equals(tenantCode) && m.externalCode().equals(externalCode))
                    .findFirst();
        }

        @Override
        public List<Mandate> list(String tenantCode, String status, String externalCode, int page, int size) {
            return mandates.values().stream()
                    .filter(m -> m.tenantCode().equals(tenantCode))
                    .filter(m -> status == null || m.status().equals(status))
                    .filter(m -> externalCode == null || m.externalCode().equals(externalCode))
                    .skip((long) page * size).limit(size).toList();
        }

        @Override
        public Optional<Mandate> update(Mandate m) {
            if (!mandates.containsKey(m.id()) || !mandates.get(m.id()).tenantCode().equals(m.tenantCode())) {
                return Optional.empty();
            }
            Mandate updated = new Mandate(m.id(), m.tenantCode(), m.externalCode(), m.orderType(),
                    m.orderRef(), m.status(), m.originId(), m.destinationId(), m.slaMinutes(), m.closedAt(),
                    m.cancelReason(), m.createdAt(), m.createdBy(), now(), m.updatedBy());
            mandates.put(m.id(), updated);
            return Optional.of(updated);
        }

        @Override
        public Optional<MandateLine> lineOf(String tenantCode, UUID mandateId) {
            return Optional.ofNullable(linesByMandate.get(mandateId.toString()))
                    .filter(l -> l.tenantCode().equals(tenantCode));
        }

        @Override
        public Optional<String> statusForLink(String tenantCode, UUID mandateId) {
            return find(tenantCode, mandateId).map(Mandate::status);
        }

        @Override
        public List<TripRef> tripsOf(String tenantCode, UUID mandateId) {
            List<TripRef> refs = new ArrayList<>();
            for (Map.Entry<String, List<MandateRef>> e : tripMandates.entrySet()) {
                for (MandateRef r : e.getValue()) {
                    if (r.mandateId().equals(mandateId.toString())) {
                        Trip t = trips.get(e.getKey());
                        if (t != null && t.tenantCode().equals(tenantCode)) {
                            refs.add(new TripRef(t.id(), t.status(), r.seq(), r.role()));
                        }
                    }
                }
            }
            return refs;
        }

        @Override
        public int openTrips(String tenantCode, UUID mandateId) {
            return (int) tripsOf(tenantCode, mandateId).stream()
                    .filter(t -> !Trip.DONE.equals(t.status()) && !Trip.CANCELLED.equals(t.status()))
                    .count();
        }
    }

    private class Cargos implements CargoStore {

        @Override
        public CargoUnit insert(CargoUnit c) {
            int partial = (int) cargo.values().stream().filter(x -> x.lineId().equals(c.lineId())).count() + 1;
            CargoUnit created = new CargoUnit(newId(), c.tenantCode(), c.lineId(), partial, c.description(),
                    c.qty(), c.qtyUnit(), c.weightKg(), c.volumeM3(), c.status(),
                    c.receiptResult(), c.receiptNotes(), c.receivedAt(), now(), c.createdBy(), now(),
                    c.updatedBy());
            cargo.put(created.id(), created);
            return created;
        }

        @Override
        public Optional<CargoUnit> find(String tenantCode, UUID id) {
            return Optional.ofNullable(cargo.get(id.toString()))
                    .filter(c -> c.tenantCode().equals(tenantCode));
        }

        @Override
        public List<UUID> lockTripsCarrying(String tenantCode, UUID cargoId) {
            return tripCargo.values().stream()
                    .filter(l -> l.tenantCode().equals(tenantCode) && l.cargoId().equals(cargoId.toString()))
                    .map(l -> UUID.fromString(l.tripId())).sorted(Comparator.comparing(UUID::toString)).toList();
        }

        @Override
        public Optional<UUID> mandateOf(String tenantCode, UUID cargoId) {
            return find(tenantCode, cargoId).flatMap(c -> linesByMandate.values().stream()
                    .filter(l -> l.id().equals(c.lineId())).findFirst())
                    .map(l -> UUID.fromString(l.mandateId()));
        }

        @Override
        public List<CargoUnit> listByMandate(String tenantCode, UUID mandateId) {
            MandateLine line = linesByMandate.get(mandateId.toString());
            if (line == null) {
                return List.of();
            }
            return cargo.values().stream()
                    .filter(c -> c.tenantCode().equals(tenantCode) && c.lineId().equals(line.id()))
                    .sorted(Comparator.comparingInt(CargoUnit::partialNo)).toList();
        }

        @Override
        public List<CargoUnit> listByTrip(String tenantCode, UUID tripId) {
            return tripCargo.values().stream()
                    .filter(l -> l.tripId().equals(tripId.toString()) && l.tenantCode().equals(tenantCode))
                    .map(l -> cargo.get(l.cargoId())).filter(Objects::nonNull).toList();
        }

        @Override
        public Optional<CargoUnit> update(CargoUnit c) {
            if (!cargo.containsKey(c.id()) || !cargo.get(c.id()).tenantCode().equals(c.tenantCode())) {
                return Optional.empty();
            }
            CargoUnit updated = new CargoUnit(c.id(), c.tenantCode(), c.lineId(), c.partialNo(),
                    c.description(), c.qty(), c.qtyUnit(), c.weightKg(), c.volumeM3(), c.status(),
                    c.receiptResult(), c.receiptNotes(), c.receivedAt(), c.createdAt(), c.createdBy(), now(),
                    c.updatedBy());
            cargo.put(c.id(), updated);
            return Optional.of(updated);
        }
    }

    private class Trips implements TripStore {

        @Override
        public Trip insert(Trip t) {
            Trip created = new Trip(newId(), t.tenantCode(), t.status(), t.originId(), t.destinationId(),
                    t.plannedStart(), t.actualStart(), t.actualEnd(), t.cancelReason(),
                    now(), t.createdBy(), now(), t.updatedBy());
            trips.put(created.id(), created);
            return created;
        }

        @Override
        public Optional<Trip> find(String tenantCode, UUID id) {
            return Optional.ofNullable(trips.get(id.toString()))
                    .filter(t -> t.tenantCode().equals(tenantCode));
        }

        @Override
        public List<Trip> list(String tenantCode, TripFilter filter, int page, int size) {
            String status = filter.status();
            UUID mandateId = filter.mandateId();
            return trips.values().stream()
                    .filter(t -> t.tenantCode().equals(tenantCode))
                    .filter(t -> status == null || t.status().equals(status))
                    .filter(t -> mandateId == null || tripMandates.getOrDefault(t.id(), List.of()).stream()
                            .anyMatch(r -> r.mandateId().equals(mandateId.toString())))
                    .skip((long) page * size).limit(size).toList();
        }

        @Override
        public Optional<Trip> update(Trip t) {
            if (!trips.containsKey(t.id()) || !trips.get(t.id()).tenantCode().equals(t.tenantCode())) {
                return Optional.empty();
            }
            Trip updated = new Trip(t.id(), t.tenantCode(), t.status(), t.originId(), t.destinationId(),
                    t.plannedStart(), t.actualStart(), t.actualEnd(), t.cancelReason(),
                    t.createdAt(), t.createdBy(), now(), t.updatedBy());
            trips.put(t.id(), updated);
            return Optional.of(updated);
        }

        @Override
        public boolean linkMandate(String tenantCode, UUID tripId, UUID mandateId, int seq, String role,
                String actor) {
            if (!mandates.containsKey(mandateId.toString())) {
                throw new IllegalArgumentException("a referenced entity does not exist");
            }
            List<MandateRef> refs = tripMandates.computeIfAbsent(tripId.toString(), k -> new ArrayList<>());
            if (refs.stream().anyMatch(r -> r.mandateId().equals(mandateId.toString()))) {
                return false;
            }
            Mandate m = mandates.get(mandateId.toString());
            refs.add(new MandateRef(m.id(), m.externalCode(), m.status(), seq, role));
            return true;
        }

        @Override
        public boolean unlinkMandate(String tenantCode, UUID tripId, UUID mandateId) {
            List<MandateRef> refs = tripMandates.getOrDefault(tripId.toString(), new ArrayList<>());
            return refs.removeIf(r -> r.mandateId().equals(mandateId.toString()));
        }

        @Override
        public List<UUID> openTripsAt(String tenantCode, UUID locationId) {
            return trips.values().stream()
                    .filter(t -> t.tenantCode().equals(tenantCode)
                            && (locationId.toString().equals(t.originId())
                                    || locationId.toString().equals(t.destinationId()))
                            && !Trip.DONE.equals(t.status()) && !Trip.CANCELLED.equals(t.status()))
                    .map(t -> UUID.fromString(t.id())).toList();
        }

        @Override
        public List<MandateRef> mandatesOf(String tenantCode, UUID tripId) {
            return List.copyOf(tripMandates.getOrDefault(tripId.toString(), List.of()));
        }

        @Override
        public int cargoOfMandateOnTrip(String tenantCode, UUID tripId, UUID mandateId) {
            MandateLine line = linesByMandate.get(mandateId.toString());
            if (line == null) {
                return 0;
            }
            return (int) tripCargo.values().stream()
                    .filter(l -> l.tripId().equals(tripId.toString()))
                    .map(l -> cargo.get(l.cargoId()))
                    .filter(c -> c != null && c.lineId().equals(line.id()))
                    .count();
        }
    }

    private class Stages implements StageStore {

        @Override
        public Stage insert(Stage s) {
            int seq = (int) stages.values().stream()
                    .filter(x -> x.subjectType().equals(s.subjectType())
                            && x.subjectId().equals(s.subjectId()))
                    .count() + 1;
            Stage created = new Stage(newId(), s.tenantCode(), s.subjectType(), s.subjectId(), seq,
                    s.stageType(), s.serviceStatus(), s.status(), s.locationId(), s.plannedStart(), s.plannedEnd(),
                    s.actualStart(), s.actualEnd(), s.checklist(), now(), s.createdBy(), now(), s.updatedBy());
            stages.put(created.id(), created);
            return created;
        }

        @Override
        public Optional<Stage> find(String tenantCode, UUID id) {
            return Optional.ofNullable(stages.get(id.toString()))
                    .filter(s -> s.tenantCode().equals(tenantCode));
        }

        @Override
        public List<Stage> listBySubject(String tenantCode, String subjectType, UUID subjectId) {
            return stages.values().stream()
                    .filter(s -> s.tenantCode().equals(tenantCode) && s.subjectType().equals(subjectType)
                            && s.subjectId().equals(subjectId.toString()))
                    .sorted(Comparator.comparingInt(Stage::seq)).toList();
        }

        @Override
        public Optional<Stage> update(Stage s) {
            Stage current = stages.get(s.id());
            if (current == null || !current.tenantCode().equals(s.tenantCode())) {
                return Optional.empty();
            }
            Stage updated = new Stage(s.id(), s.tenantCode(), current.subjectType(), current.subjectId(),
                    current.seq(), s.stageType(), s.serviceStatus(), current.status(), s.locationId(), s.plannedStart(),
                    s.plannedEnd(), current.actualStart(), current.actualEnd(), s.checklist(),
                    current.createdAt(), current.createdBy(), now(), s.updatedBy());
            stages.put(s.id(), updated);
            return Optional.of(updated);
        }

        @Override
        public Optional<Stage> start(String tenantCode, UUID id, OffsetDateTime at, String actor) {
            Stage current = stages.get(id.toString());
            if (current == null || !current.tenantCode().equals(tenantCode)
                    || !Stage.PENDING.equals(current.status())) {
                return Optional.empty();
            }
            boolean anotherRunning = stages.values().stream()
                    .anyMatch(s -> s.subjectType().equals(current.subjectType())
                            && s.subjectId().equals(current.subjectId())
                            && Stage.RUNNING.equals(s.status()));
            if (anotherRunning) {
                throw new IllegalStateException("conflict: another row already holds that state");
            }
            Stage started = new Stage(current.id(), tenantCode, current.subjectType(), current.subjectId(),
                    current.seq(), current.stageType(), current.serviceStatus(), Stage.RUNNING, current.locationId(),
                    current.plannedStart(), current.plannedEnd(), at, current.actualEnd(),
                    current.checklist(), current.createdAt(), current.createdBy(), now(), actor);
            stages.put(started.id(), started);
            return Optional.of(started);
        }

        @Override
        public Optional<Stage> close(String tenantCode, UUID id, OffsetDateTime at, String actor) {
            Stage current = stages.get(id.toString());
            if (current == null || !current.tenantCode().equals(tenantCode)
                    || !Stage.RUNNING.equals(current.status())) {
                return Optional.empty();
            }
            Stage closed = new Stage(current.id(), tenantCode, current.subjectType(), current.subjectId(),
                    current.seq(), current.stageType(), current.serviceStatus(), Stage.CLOSED, current.locationId(),
                    current.plannedStart(), current.plannedEnd(), current.actualStart(), at,
                    current.checklist(), current.createdAt(), current.createdBy(), now(), actor);
            stages.put(closed.id(), closed);
            return Optional.of(closed);
        }

        @Override
        public StageActivity insertActivity(StageActivity a) {
            int seq = (int) activities.values().stream().filter(x -> x.stageId().equals(a.stageId())).count()
                    + 1;
            StageActivity created = new StageActivity(newId(), a.tenantCode(), a.stageId(), seq,
                    a.activityType(), a.status(), a.assignee(), a.assignmentId(), a.evidence(), a.doneAt(),
                    now(), a.createdBy(), now(), a.updatedBy());
            activities.put(created.id(), created);
            return created;
        }

        @Override
        public Optional<StageActivity> findActivity(String tenantCode, UUID id) {
            return Optional.ofNullable(activities.get(id.toString()))
                    .filter(a -> a.tenantCode().equals(tenantCode));
        }

        @Override
        public List<StageActivity> listActivities(String tenantCode, UUID stageId) {
            return activities.values().stream()
                    .filter(a -> a.tenantCode().equals(tenantCode) && a.stageId().equals(stageId.toString()))
                    .sorted(Comparator.comparingInt(StageActivity::seq)).toList();
        }

        @Override
        public Optional<StageActivity> updateActivity(StageActivity a) {
            StageActivity current = activities.get(a.id());
            if (current == null || !current.tenantCode().equals(a.tenantCode())) {
                return Optional.empty();
            }
            StageActivity updated = new StageActivity(a.id(), a.tenantCode(), current.stageId(),
                    current.seq(), current.activityType(), a.status(), a.assignee(), a.assignmentId(),
                    a.evidence(), a.doneAt(), current.createdAt(), current.createdBy(), now(), a.updatedBy());
            activities.put(a.id(), updated);
            return Optional.of(updated);
        }
    }

    private class Assignments implements AssignmentStore {

        @Override
        public Assignment insert(Assignment a) {
            Assignment created = new Assignment(newId(), a.tenantCode(), a.tripId(), a.resourceType(),
                    a.resourceId(), a.validFrom(), a.validTo(), a.reason(),
                    now(), a.createdBy(), now(), a.updatedBy());
            assignments.put(created.id(), created);
            return created;
        }

        @Override
        public Optional<Assignment> find(String tenantCode, UUID id) {
            return Optional.ofNullable(assignments.get(id.toString()))
                    .filter(a -> a.tenantCode().equals(tenantCode));
        }

        @Override
        public List<Assignment> listByTrip(String tenantCode, UUID tripId) {
            return assignments.values().stream()
                    .filter(a -> a.tenantCode().equals(tenantCode) && a.tripId().equals(tripId.toString()))
                    .sorted(Comparator.comparing(Assignment::validFrom)).toList();
        }

        @Override
        public Optional<Assignment> end(String tenantCode, UUID id, OffsetDateTime validTo, String reason,
                String actor) {
            Assignment current = assignments.get(id.toString());
            if (current == null || !current.tenantCode().equals(tenantCode) || current.validTo() != null) {
                return Optional.empty();
            }
            Assignment ended = new Assignment(current.id(), tenantCode, current.tripId(),
                    current.resourceType(), current.resourceId(), current.validFrom(), validTo,
                    reason == null ? current.reason() : reason,
                    current.createdAt(), current.createdBy(), now(), actor);
            assignments.put(ended.id(), ended);
            return Optional.of(ended);
        }
    }

    private class TripCargos implements TripCargoStore {

        @Override
        public Optional<TripCargoLink> insert(TripCargoLink l) {
            String key = l.tripId() + "/" + l.cargoId();
            if (tripCargo.containsKey(key)) {
                return Optional.empty();
            }
            CargoUnit unit = cargo.get(l.cargoId());
            if (unit == null) {
                throw new IllegalArgumentException("a referenced entity does not exist");
            }
            TripCargoLink created = new TripCargoLink(l.tripId(), l.cargoId(), l.tenantCode(),
                    l.loadedAtStage(), l.unloadedAtStage(), now(), l.createdBy(), now(), l.updatedBy());
            tripCargo.put(key, created);
            return Optional.of(created);
        }

        @Override
        public Optional<TripCargoLink> find(String tenantCode, UUID tripId, UUID cargoId) {
            return Optional.ofNullable(tripCargo.get(tripId + "/" + cargoId))
                    .filter(l -> l.tenantCode().equals(tenantCode));
        }

        @Override
        public List<TripCargoLink> listByTrip(String tenantCode, UUID tripId) {
            return tripCargo.values().stream()
                    .filter(l -> l.tenantCode().equals(tenantCode) && l.tripId().equals(tripId.toString()))
                    .toList();
        }

        @Override
        public Optional<TripCargoLink> update(TripCargoLink l) {
            String key = l.tripId() + "/" + l.cargoId();
            TripCargoLink current = tripCargo.get(key);
            if (current == null || !current.tenantCode().equals(l.tenantCode())) {
                return Optional.empty();
            }
            TripCargoLink updated = new TripCargoLink(l.tripId(), l.cargoId(), l.tenantCode(),
                    l.loadedAtStage(), l.unloadedAtStage(), current.createdAt(), current.createdBy(), now(),
                    l.updatedBy());
            tripCargo.put(key, updated);
            return Optional.of(updated);
        }

        @Override
        public boolean delete(String tenantCode, UUID tripId, UUID cargoId) {
            return tripCargo.remove(tripId + "/" + cargoId) != null;
        }

        @Override
        public int markLoadedByStage(String tenantCode, UUID stageId, String actor) {
            return mark(stageId.toString(), true, actor);
        }

        @Override
        public int markDeliveredByStage(String tenantCode, UUID stageId, String actor) {
            return mark(stageId.toString(), false, actor);
        }

        private int mark(String stageId, boolean load, String actor) {
            int n = 0;
            for (TripCargoLink l : List.copyOf(tripCargo.values())) {
                String stage = load ? l.loadedAtStage() : l.unloadedAtStage();
                if (!stageId.equals(stage)) {
                    continue;
                }
                CargoUnit c = cargo.get(l.cargoId());
                if (c == null) {
                    continue;
                }
                boolean movable = load
                        ? CargoUnit.ANNOUNCED.equals(c.status()) || CargoUnit.READY.equals(c.status())
                        : CargoUnit.PICKED.equals(c.status());
                if (!movable) {
                    continue;
                }
                cargo.put(c.id(), new CargoUnit(c.id(), c.tenantCode(), c.lineId(), c.partialNo(),
                        c.description(), c.qty(), c.qtyUnit(), c.weightKg(), c.volumeM3(),
                        load ? CargoUnit.PICKED : CargoUnit.DELIVERED,
                        c.receiptResult(), c.receiptNotes(), c.receivedAt(),
                        c.createdAt(), c.createdBy(), now(), actor));
                n++;
            }
            return n;
        }
    }

    private class Locations implements LocationStore {

        @Override
        public Location insert(Location l) {
            Location created = new Location(newId(), l.tenantCode(), l.name(), l.type(), l.externalCode(),
                    l.geomGeojson(), l.geofenceId(), now(), l.createdBy(), now(), l.updatedBy());
            locations.put(created.id(), created);
            return created;
        }

        @Override
        public Optional<Location> insertIfAbsent(Location l) {
            return byCode(l.tenantCode(), l.externalCode()).isPresent() ? Optional.empty() : Optional.of(insert(l));
        }

        @Override
        public Optional<Location> byCode(String tenantCode, String externalCode) {
            return locations.values().stream()
                    .filter(l -> l.tenantCode().equals(tenantCode) && externalCode.equals(l.externalCode()))
                    .findFirst();
        }

        @Override
        public Optional<Location> find(String tenantCode, UUID id) {
            return Optional.ofNullable(locations.get(id.toString())).filter(l -> l.tenantCode().equals(tenantCode));
        }

        @Override
        public List<Location> list(String tenantCode, String q, String type, String status, int page, int size) {
            return locations.values().stream().filter(l -> l.tenantCode().equals(tenantCode))
                    .filter(l -> status == null || status.equals(l.placement().status()))
                    .skip((long) page * size).limit(size).toList();
        }

        @Override
        public Optional<Location> update(Location l) {
            if (find(l.tenantCode(), UUID.fromString(l.id())).isEmpty()) {
                return Optional.empty();
            }
            Location updated = new Location(l.id(), l.tenantCode(), l.name(), l.type(), l.externalCode(),
                    l.geomGeojson(), locations.get(l.id()).geofenceId(), l.createdAt(), l.createdBy(), now(), l.updatedBy(),
                    locations.get(l.id()).placement());
            locations.put(l.id(), updated);
            return Optional.of(updated);
        }

        @Override
        public Optional<Location> setPlacement(String tenantCode, UUID id, Location.Placement placement,
                Integer geofenceId, String actor) {
            return find(tenantCode, id).map(location -> {
                Location updated = location.withPlacement(placement,
                        geofenceId == null ? location.geofenceId() : geofenceId, actor);
                locations.put(location.id(), updated);
                return updated;
            });
        }

        @Override
        public Optional<Location> setPlacementIfOpen(String tenantCode, UUID id, Location.Placement placement,
                int geofenceId, String actor) {
            return find(tenantCode, id).filter(l -> l.geofenceId() == null
                    && !Location.RESOLVED.equals(l.placement().status())
                    && !Location.REJECTED.equals(l.placement().status()))
                    .map(location -> {
                        Location updated = location.withPlacement(placement, geofenceId, actor);
                        locations.put(location.id(), updated);
                        return updated;
                    });
        }

        @Override
        public Optional<Location> setGeofence(String tenantCode, UUID id, Integer geofenceId, String actor) {
            return find(tenantCode, id).map(location -> {
                Location updated = location.withGeofence(geofenceId, actor);
                locations.put(location.id(), updated);
                return updated;
            });
        }
    }

    private class Milestones implements MilestoneStore {

        private static String key(String tenantCode, String tripId, String milestone) {
            return tenantCode + "/" + tripId + "/" + milestone;
        }

        @Override
        public List<TripMilestone> list(String tenantCode, UUID tripId) {
            return milestones.values().stream()
                    .filter(m -> m.tenantCode().equals(tenantCode) && m.tripId().equals(tripId.toString())).toList();
        }

        @Override
        public Optional<TripMilestone> find(String tenantCode, UUID tripId, String milestone) {
            return Optional.ofNullable(milestones.get(key(tenantCode, tripId.toString(), milestone)));
        }

        @Override
        public TripMilestone save(TripMilestone m) {
            milestones.put(key(m.tenantCode(), m.tripId(), m.milestone()), m);
            return m;
        }

        /** Without the trip's service, places and plan, which the database store joins in. */
        @Override
        public List<PendingMilestone> pending(String tenantCode, int limit) {
            return milestones.values().stream()
                    .filter(m -> m.tenantCode().equals(tenantCode) && m.isPending())
                    .sorted(Comparator.comparing(TripMilestone::proposedAt,
                            Comparator.nullsLast(Comparator.naturalOrder())))
                    .limit(limit).map(m -> new PendingMilestone(m, null, null, null, null)).toList();
        }
    }

    private class Lives implements TripLiveStore {

        @Override
        public List<TripLiveRow> list(String tenantCode) {
            return live.values().stream().filter(p -> p.tenantCode().equals(tenantCode))
                    .map(InMemoryTripsWorld::row).toList();
        }

        @Override
        public Optional<TripLiveRow> find(String tenantCode, UUID tripId) {
            return Optional.ofNullable(live.get(tripId.toString())).filter(p -> p.tenantCode().equals(tenantCode))
                    .map(InMemoryTripsWorld::row);
        }

        @Override
        public Optional<TripLiveRow> lockWatched(String tenantCode, UUID tripId) {
            return find(tenantCode, tripId);
        }

        @Override
        public void upsert(TripLiveProjection projection) {
            live.put(projection.tripId(), projection);
        }

        @Override
        public void delete(String tenantCode, UUID tripId) {
            live.remove(tripId.toString());
        }

        @Override
        public List<TripLiveRow> watched() {
            return live.values().stream().filter(p -> p.assetId() != null
                    && (p.originGeofenceId() != null || p.destinationGeofenceId() != null))
                    .map(InMemoryTripsWorld::row).toList();
        }

        @Override
        public void saveMotorState(String tenantCode, UUID tripId, Integer currentGeofenceId, boolean originVisited,
                boolean destinationVisited) {
            // the in-memory row keeps no motor state
        }
    }

    private static TripLiveRow row(TripLiveProjection p) {
        return new TripLiveRow(p.tripId(), p.tenantCode(), p.mandateCodes(), p.assetId(), "v",
                p.originGeofenceId(), p.destinationGeofenceId(), p.originGeofenceLabel(),
                p.destinationGeofenceLabel(), p.stopGeofenceIds(), p.status(), p.driverId(),
                p.driverName(), p.driverContactPhone(), p.secondDriverId() != null, p.secondDriverId(),
                p.secondDriverName(), p.secondDriverContactPhone(), p.carrierId(), p.carrierName(),
                p.carrierContactPhone(), p.ramplaPlate(), p.startTime(), p.endTime(), p.estimatedArrivalTime(),
                p.typeLoad(), null, false, false, null, null, null, null);
    }

    private class Audits implements AuditStore {

        @Override
        public AuditEvent append(AuditEvent e) {
            AuditEvent created = new AuditEvent(auditSeq.incrementAndGet(), e.tenantCode(), e.actor(),
                    e.action(), e.entityType(), e.entityId(), e.tripId(), e.details(), now());
            audit.add(created);
            return created;
        }

        @Override
        public List<AuditEvent> list(String tenantCode, String entityType, String entityId,
                OffsetDateTime before, Long beforeId, int limit) {
            return audit.stream()
                    .filter(e -> e.tenantCode().equals(tenantCode))
                    .filter(e -> entityType == null || entityType.equals(e.entityType()))
                    .filter(e -> entityId == null || entityId.equals(e.entityId()))
                    .sorted(Comparator.comparing(AuditEvent::id).reversed())
                    .limit(limit).toList();
        }
    }
}
