package com.microboxlabs.miot.trips.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.core.db.PgTx;
import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.trips.domain.Assignment;
import com.microboxlabs.miot.trips.domain.FeedProfile;
import com.microboxlabs.miot.trips.domain.FeedService;
import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.domain.Mandate;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.domain.TripRef;
import com.microboxlabs.miot.trips.dto.AssignmentRequest;
import com.microboxlabs.miot.trips.dto.AssignmentView;
import com.microboxlabs.miot.trips.dto.FeedResult;
import com.microboxlabs.miot.trips.dto.FeedServiceRequest;
import com.microboxlabs.miot.trips.dto.MandateRequest;
import com.microboxlabs.miot.trips.dto.StageRequest;
import com.microboxlabs.miot.trips.dto.StageView;
import com.microboxlabs.miot.trips.dto.TripRequest;
import com.microboxlabs.miot.trips.dto.TripView;
import com.microboxlabs.miot.trips.store.FeedStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Reconciles one service of a feed with the plan the feed sent: reads the mandate, the trip and the resources,
 * decides with the feed profile's rules, and applies the steps in one transaction through the trips services, so
 * their checks, the board and the audit apply as for any API call. A step that fails undoes the whole service. The
 * feed declares the plan only: the trip's monitor starts and closes its stages and closes the mandate.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class FeedReconciler {

    public static final String CREATE = "create";
    public static final String UPDATE = "update";
    public static final String SKIP = "skip";
    public static final String REPORT = "report";
    public static final String ERROR = "error";
    /** Accepted from the feed, not applied yet. */
    public static final String PENDING = "pending";

    private static final Duration SAME_TIME = Duration.ofMinutes(1);
    private static final String TRUCK = Assignment.TRUCK;
    private static final String TRAILER = Assignment.TRAILER;
    private static final String DRIVER = Assignment.DRIVER;

    private final FeedStore feeds;
    private final MandateService mandates;
    private final TripService trips;
    private final StageService stages;
    private final AssignmentService assignments;
    private final LocationService locations;
    private final FleetResources fleet;
    private final Transactions tx;
    private final ObjectMapper json;
    private final Clock clock;

    @Inject
    FeedReconciler(FeedStore feeds, MandateService mandates, TripService trips, StageService stages,
            AssignmentService assignments, LocationService locations, FleetResources fleet, Transactions tx,
            ObjectMapper json) {
        this(feeds, mandates, trips, stages, assignments, locations, fleet, tx, json, Clock.systemUTC());
    }

    // Mirrors CDI dependencies while allowing a deterministic clock in tests.
    @SuppressWarnings("java:S107")
    public FeedReconciler(FeedStore feeds, MandateService mandates, TripService trips, StageService stages,
            AssignmentService assignments, LocationService locations, FleetResources fleet, Transactions tx,
            ObjectMapper json, Clock clock) {
        this.feeds = feeds;
        this.mandates = mandates;
        this.trips = trips;
        this.stages = stages;
        this.assignments = assignments;
        this.locations = locations;
        this.fleet = fleet;
        this.tx = tx;
        this.json = json;
        this.clock = clock;
    }

    /** The feed's profile; 404 when the tenant has no such feed or it is switched off. */
    public FeedProfile profile(String tenantCode, String feedKey) {
        return feeds.profile(tenantCode, feedKey).filter(FeedProfile::active)
                .orElseThrow(() -> new NoSuchElementException("feed " + feedKey + " not found"));
    }

    /** The hash of the desired state, without {@code source}: the same hash means nothing to apply. */
    public String hash(FeedServiceRequest desired) {
        FeedServiceRequest compared = new FeedServiceRequest(desired.orderType(), desired.orderRef(),
                desired.origin(), desired.destination(), utc(desired.plannedStart()), utc(desired.plannedEnd()),
                desired.resourcesOrEmpty(), null);
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(
                    json.writeValueAsString(compared).getBytes(StandardCharsets.UTF_8)));
        } catch (JsonProcessingException | NoSuchAlgorithmException e) {
            throw new IllegalStateException("Could not hash the desired state", e);
        }
    }

    /**
     * Reconciles {@code externalCode} with {@code desired}. With {@code dryRun} it only reads and returns what it
     * would do. A step that throws undoes every step of the service and is recorded as its last outcome.
     */
    public FeedResult reconcile(String tenantCode, String actor, String feedKey, String externalCode,
            FeedServiceRequest desired, boolean dryRun) {
        String code = Check.required(externalCode, "externalCode", 128);
        if (desired == null) {
            throw new IllegalArgumentException("body is required");
        }
        FeedProfile profile = profile(tenantCode, feedKey);
        if (dryRun) {
            return plan(tenantCode, actor, profile, code, desired).result(true);
        }
        return applyLocked(tenantCode, actor, profile, code, desired, false);
    }

    /**
     * Keeps {@code desired} as the service's latest state, to be applied by {@link #recheck}. Returns false when it
     * is the state already applied or waiting: nothing new to apply.
     */
    public boolean accept(String tenantCode, String feedKey, String externalCode, FeedServiceRequest desired) {
        String code = Check.required(externalCode, "externalCode", 128);
        if (desired == null) {
            throw new IllegalArgumentException("desired is required for " + code);
        }
        profile(tenantCode, feedKey);
        String hash = hash(desired);
        return tx.inTransaction(() -> {
            FeedService before = feeds.lockService(tenantCode, feedKey, code);
            // the same state, applied or already waiting; a failed apply keeps no hash, so a resend counts
            if (hash.equals(before.desiredHash()) && !REPORT.equals(before.lastAction())) {
                synchronizeClosedService(before);
                return false;
            }
            feeds.saveService(new FeedService(tenantCode, feedKey, code, write(desired), hash, before.mandateId(),
                    before.tripId(), true, PENDING, before.lastResult(), before.lastReconciledAt()));
            return true;
        });
    }

    private void synchronizeClosedService(FeedService service) {
        if (!service.open()) {
            return;
        }
        TripView trip = service.tripId() == null ? null
                : trips.detail(service.tenantCode(), UUID.fromString(service.tripId()));
        Optional<Mandate> mandate = service.mandateId() == null ? Optional.empty()
                : Optional.of(mandates.get(service.tenantCode(), UUID.fromString(service.mandateId())));
        if (finished(trip, mandate)) {
            FeedResult result = new FeedResult(service.externalCode(), SKIP, false, service.mandateId(),
                    service.tripId(), List.of(), List.of(), List.of());
            feeds.saveService(new FeedService(service.tenantCode(), service.feedKey(), service.externalCode(),
                    service.desired(), service.desiredHash(), service.mandateId(), service.tripId(), false,
                    SKIP, write(result), now()));
        }
    }

    /** Applies the service's latest desired state, after {@link #accept}. */
    public FeedResult recheck(String tenantCode, String actor, String feedKey, String externalCode) {
        return applyLocked(tenantCode, actor, profile(tenantCode, feedKey), externalCode, null, true);
    }

    public FeedResult recheck(String tenantCode, String feedKey, String externalCode) {
        return recheck(tenantCode, "feed:" + feedKey + ":clock", feedKey, externalCode);
    }

    private record Attempt(FeedResult result, RuntimeException failure) {
    }

    private FeedResult applyLocked(String tenantCode, String actor, FeedProfile profile, String code,
            FeedServiceRequest requested, boolean replay) {
        Attempt attempt = tx.inTransaction(() -> {
            FeedService before = replay ? feeds.service(tenantCode, profile.feedKey(), code)
                    .orElseThrow(() -> new NoSuchElementException("feed service " + code + " not found"))
                    : feeds.lockService(tenantCode, profile.feedKey(), code);
            FeedServiceRequest desired = replay ? read(before.desired()) : requested;
            try {
                return PgTx.savepoint(() -> {
                    Plan plan = plan(tenantCode, actor, profile, code, desired);
                    plan.run();
                    FeedResult result = plan.result(false);
                    feeds.saveService(new FeedService(tenantCode, profile.feedKey(), code, write(desired),
                            hash(desired), plan.mandateId != null ? plan.mandateId : before.mandateId(),
                            plan.tripId != null ? plan.tripId : before.tripId(), plan.isOpen(), plan.action,
                            write(result), plan.evaluatedAt));
                    return new Attempt(result, null);
                });
            } catch (RuntimeException e) {
                // The business changes roll back to the savepoint; the service row remains locked.
                recordFailure(before, desired, e);
                return new Attempt(null, e);
            }
        });
        if (attempt.failure() != null) {
            throw attempt.failure();
        }
        return attempt.result();
    }

    private void recordFailure(FeedService before, FeedServiceRequest desired, RuntimeException failure) {
        FeedResult failed = new FeedResult(before.externalCode(), ERROR, false, before.mandateId(), before.tripId(),
                List.of(), List.of(), List.of(String.valueOf(failure.getMessage())));
        feeds.saveService(new FeedService(before.tenantCode(), before.feedKey(), before.externalCode(),
                write(desired), "", before.mandateId(), before.tripId(), true, ERROR, write(failed), now()));
    }

    // ---------------------------------------------------------------- reading and deciding

    private Plan plan(String tenantCode, String actor, FeedProfile profile, String code, FeedServiceRequest d) {
        OffsetDateTime now = now();
        Plan plan = new Plan(code, now);
        Optional<Mandate> mandate = mandates.list(tenantCode, null, code, 0, 1).stream()
                .filter(m -> m.externalCode().equals(code)).findFirst();
        TripView trip = feeds.service(tenantCode, profile.feedKey(), code).map(FeedService::tripId)
                .map(id -> trips.detail(tenantCode, UUID.fromString(id)))
                .orElseGet(() -> mandate.flatMap(m -> currentTrip(tenantCode, m))
                        .map(ref -> trips.detail(tenantCode, UUID.fromString(ref.tripId()))).orElse(null));
        plan.mandateId = mandate.map(Mandate::id).orElse(null);
        plan.tripId = trip == null ? null : trip.id();

        ResolvedResources resources = resolveResources(tenantCode, d);
        Resource truck = resources.truck();
        Resource trailer = resources.trailer();
        List<Resource> drivers = resources.drivers();
        Place origin = place(tenantCode, d.origin());
        Place destination = place(tenantCode, d.destination());

        boolean ended = d.plannedEnd() != null && !d.plannedEnd().isAfter(now);

        if (finished(trip, mandate) || (trip == null && ended)) {
            return plan.decided(SKIP, false);
        }
        PlanningContext context = new PlanningContext(tenantCode, actor, profile, d);
        if (trip == null) {
            List<String> missing = missingResources(profile, d, resources);
            if (!missing.isEmpty()) {
                plan.errors.addAll(missing);
                return plan.decided(REPORT, true);
            }
            warnAboutOptionalResources(plan, profile, resources);
            planPlaces(plan, tenantCode, actor, origin, destination);
            planCreate(plan, context, code, mandate.orElse(null), resources, origin, destination);
            return plan.decided(CREATE, true);
        }
        List<Resource> named = new ArrayList<>(drivers);
        named.add(0, trailer);
        named.add(0, truck);
        warnAbout(plan, named);
        planPlaces(plan, tenantCode, actor, origin, destination);
        planRoute(plan, tenantCode, actor, trip, origin, destination);
        planChanges(plan, context, mandate.orElseThrow(), trip, resources);
        return plan.decided(UPDATE, true);
    }

    private record PlanningContext(String tenantCode, String actor, FeedProfile profile,
            FeedServiceRequest desired) {
    }

    private record ResolvedResources(Resource truck, Resource trailer, List<Resource> drivers, boolean clearDrivers) {
    }

    private ResolvedResources resolveResources(String tenantCode, FeedServiceRequest desired) {
        FeedServiceRequest.Resources r = desired.resourcesOrEmpty();
        List<Resource> drivers = r.drivers() == null ? List.of() : r.drivers().stream()
                .filter(k -> k != null && !k.isBlank()).map(k -> resolve(tenantCode, DRIVER, k)).toList();
        return new ResolvedResources(resolve(tenantCode, TRUCK, r.truck()),
                resolve(tenantCode, TRAILER, r.trailer()), drivers,
                desired.resources() != null && r.drivers() != null && r.drivers().isEmpty());
    }

    private static boolean finished(TripView trip, Optional<Mandate> mandate) {
        if (trip != null) {
            return Trip.DONE.equals(trip.status()) || Trip.CANCELLED.equals(trip.status());
        }
        return mandate.filter(m -> Mandate.CLOSED.equals(m.status()) || Mandate.CANCELLED.equals(m.status()))
                .isPresent();
    }

    private static List<String> missingResources(FeedProfile profile, FeedServiceRequest desired,
            ResolvedResources resources) {
        Map<String, Resource> required = new LinkedHashMap<>();
        required.put(TRUCK, resources.truck());
        required.put(TRAILER, resources.trailer());
        required.put(DRIVER, resources.drivers().isEmpty() ? null : resources.drivers().get(0));
        List<String> missing = new ArrayList<>();
        if (desired.plannedStart() == null || desired.plannedEnd() == null) {
            missing.add("plannedStart and plannedEnd are required");
        }
        for (String type : profile.requiredResources()) {
            Resource res = required.get(type);
            missing.add(res == null ? type + " is required" : res.problem());
        }
        missing.removeIf(Objects::isNull);
        return missing;
    }

    private Optional<TripRef> currentTrip(String tenantCode, Mandate m) {
        List<TripRef> refs = mandates.tripsOf(tenantCode, UUID.fromString(m.id()));
        return refs.stream().filter(t -> !Trip.CANCELLED.equals(t.status()) && !Trip.DONE.equals(t.status()))
                .findFirst().or(() -> refs.stream().filter(t -> !Trip.CANCELLED.equals(t.status())).findFirst())
                .or(() -> refs.stream().findFirst());
    }

    private Resource resolve(String tenantCode, String type, String key) {
        if (key == null || key.isBlank()) {
            return null;
        }
        Optional<FleetResources.Match> found = DRIVER.equals(type)
                ? fleet.driverByDocument(tenantCode, key)
                : fleet.byPlate(tenantCode, type, key);
        return new Resource(type, key.trim(), found.map(FleetResources.Match::id).orElse(null),
                found.map(FleetResources.Match::active).orElse(false));
    }

    /** A place the feed names; {@code found} null when no location has that external code yet. */
    private Place place(String tenantCode, String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        return new Place(name, locations.byCode(tenantCode, name).orElse(null));
    }

    /** Creates the places that do not exist yet and warns about those without a geofence. */
    private void planPlaces(Plan plan, String tenantCode, String actor, Place... places) {
        for (Place p : Arrays.stream(places).filter(Objects::nonNull)
                .sorted(Comparator.comparing(Place::code)).toList()) {
            if (plan.locationIds.containsKey(p.code()) || plan.creating.contains(p.code())) {
                continue;
            }
            if (p.found() == null) {
                plan.creating.add(p.code());
                plan.step("create location " + p.code(), () -> plan.locationIds.put(p.code(),
                        locations.resolve(tenantCode, actor, p.code()).id()));
            } else {
                plan.locationIds.put(p.code(), p.found().id());
            }
            if (p.found() == null || p.found().geofenceId() == null) {
                plan.warnings.add("location " + p.code() + " has no GPS geofence");
            }
        }
    }

    /** Moves the trip to the origin and destination the feed names, when they differ. */
    private void planRoute(Plan plan, String tenantCode, String actor, TripView trip, Place origin,
            Place destination) {
        boolean originChanged = origin != null
                && (origin.found() == null || !origin.found().id().equals(trip.originId()));
        boolean destinationChanged = destination != null
                && (destination.found() == null || !destination.found().id().equals(trip.destinationId()));
        if (!originChanged && !destinationChanged) {
            return;
        }
        UUID tripId = UUID.fromString(trip.id());
        plan.step("change route", () -> trips.update(tenantCode, actor, tripId, new TripRequest(
                originChanged ? plan.locationId(origin) : null,
                destinationChanged ? plan.locationId(destination) : null, null, null, null)));
    }

    private static void warnAbout(Plan plan, List<Resource> resources) {
        resources.stream().filter(Objects::nonNull).map(Resource::problem).filter(Objects::nonNull)
                .forEach(plan.warnings::add);
    }

    private static void warnAboutOptionalResources(Plan plan, FeedProfile profile, ResolvedResources resources) {
        List<Resource> optional = new ArrayList<>();
        if (!profile.requiredResources().contains(TRUCK)) {
            optional.add(resources.truck());
        }
        if (!profile.requiredResources().contains(TRAILER)) {
            optional.add(resources.trailer());
        }
        int firstOptionalDriver = profile.requiredResources().contains(DRIVER) ? 1 : 0;
        optional.addAll(resources.drivers().stream().skip(firstOptionalDriver).toList());
        warnAbout(plan, optional);
    }

    // ---------------------------------------------------------------- the steps

    private void planCreate(Plan plan, PlanningContext context, String code, Mandate mandate,
            ResolvedResources resources, Place origin, Place destination) {
        String tenantCode = context.tenantCode();
        String actor = context.actor();
        FeedProfile profile = context.profile();
        FeedServiceRequest d = context.desired();
        Resource truck = resources.truck();
        Resource trailer = resources.trailer();
        List<Resource> drivers = resources.drivers();
        if (mandate == null) {
            plan.step("create mandate " + code, () -> plan.mandateId = mandates.createOrGet(tenantCode, actor,
                    new MandateRequest(code, d.orderType(), d.orderRef(), plan.locationId(origin),
                            plan.locationId(destination), null)).mandate().id());
        }
        List<FeedProfile.StagePlan> planned = profile.stages();
        plan.step("create trip with stages " + planned.stream().map(FeedProfile.StagePlan::stageType).toList(), () -> {
            List<StageRequest> stageRequests = planned.stream().map(s -> new StageRequest(s.stageType(),
                    s.serviceStatus(), null, null, s.stageType().equals(profile.arrivalStage()) ? d.plannedEnd() : null,
                    null)).toList();
            TripView created = trips.create(tenantCode, actor, new TripRequest(plan.locationId(origin),
                    plan.locationId(destination), d.plannedStart(), List.of(plan.mandateId), stageRequests,
                    profile.monitor()));
            plan.tripId = created.id();
        });
        for (Resource res : assignable(truck, trailer, drivers)) {
            plan.step("assign " + res.type() + " " + res.key(), () -> assignments.create(tenantCode, actor,
                    UUID.fromString(plan.tripId), new AssignmentRequest(res.type(), res.id().toString(), null, null)));
        }
    }

    private void planChanges(Plan plan, PlanningContext context, Mandate mandate, TripView trip,
            ResolvedResources resources) {
        String tenantCode = context.tenantCode();
        String actor = context.actor();
        FeedProfile profile = context.profile();
        FeedServiceRequest d = context.desired();
        UUID tripId = UUID.fromString(trip.id());
        if (d.plannedStart() != null && differs(trip.plannedStart(), d.plannedStart())) {
            plan.step("change planned start", () -> trips.update(tenantCode, actor, tripId,
                    new TripRequest(null, null, d.plannedStart(), null, null)));
        }
        StageView arrival = stage(trip, profile.arrivalStage());
        if (d.plannedEnd() != null && arrival != null && Stage.PENDING.equals(arrival.status())
                && differs(arrival.plannedEnd(), d.plannedEnd())) {
            plan.step("change planned end", () -> stages.update(tenantCode, actor, UUID.fromString(arrival.id()),
                    new StageRequest(null, null, null, null, d.plannedEnd(), null)));
        }
        if (d.orderRef() != null && !d.orderRef().equals(mandate.orderRef())) {
            plan.step("change order reference", () -> mandates.update(tenantCode, actor,
                    UUID.fromString(mandate.id()), new MandateRequest(null, null, d.orderRef(), null, null, null)));
        }
        planAssignments(plan, tenantCode, actor, trip, resources);
    }

    /** Ends the windows of resources the feed no longer names and opens windows for the new ones. */
    private void planAssignments(Plan plan, String tenantCode, String actor, TripView trip,
            ResolvedResources resources) {
        Resource truck = resources.truck();
        Resource trailer = resources.trailer();
        List<Resource> drivers = resources.drivers();
        UUID tripId = UUID.fromString(trip.id());
        List<AssignmentView> open = trip.assignments().stream().filter(a -> a.validTo() == null).toList();
        for (Resource res : new Resource[] {truck, trailer}) {
            planVehicleAssignment(plan, tenantCode, actor, tripId, open, res);
        }
        if (trailer == null) {
            open.stream().filter(a -> TRAILER.equals(a.resourceType())).forEach(a ->
                    plan.step("end trailer window", () -> assignments.end(tenantCode, actor,
                            UUID.fromString(a.id()), null, "trailer no longer in the feed")));
        }
        List<Resource> wanted = drivers.stream().filter(Resource::usable)
                .collect(java.util.stream.Collectors.toMap(Resource::id, resource -> resource,
                        (first, duplicate) -> first, LinkedHashMap::new)).values().stream().toList();
        if (wanted.isEmpty() && !resources.clearDrivers()) {
            return;
        }
        List<AssignmentView> openDrivers = open.stream().filter(a -> DRIVER.equals(a.resourceType())).toList();
        int retained = 0;
        while (retained < openDrivers.size() && retained < wanted.size()
                && openDrivers.get(retained).resourceId().equals(wanted.get(retained).id().toString())) {
            retained++;
        }
        for (AssignmentView a : openDrivers.subList(retained, openDrivers.size())) {
            plan.step("end driver window", () -> assignments.end(tenantCode, actor, UUID.fromString(a.id()),
                    null, "driver order changed by the feed"));
        }
        for (Resource res : wanted.subList(retained, wanted.size())) {
            plan.step("assign driver " + res.key(), () -> assignments.create(tenantCode, actor, tripId,
                    new AssignmentRequest(DRIVER, res.id().toString(), null, null)));
        }
    }

    private void planVehicleAssignment(Plan plan, String tenantCode, String actor, UUID tripId,
            List<AssignmentView> open, Resource res) {
        if (res == null || !res.usable()) {
            return;
        }
        Optional<AssignmentView> current = open.stream().filter(a -> a.resourceType().equals(res.type()))
                .findFirst();
        if (current.isPresent() && current.get().resourceId().equals(res.id().toString())) {
            return;
        }
        current.ifPresent(a -> plan.step("end " + res.type() + " window", () -> assignments.end(tenantCode,
                actor, UUID.fromString(a.id()), null, "changed by the feed")));
        plan.step("assign " + res.type() + " " + res.key(), () -> assignments.create(tenantCode, actor, tripId,
                new AssignmentRequest(res.type(), res.id().toString(), null, null)));
    }

    private static List<Resource> assignable(Resource truck, Resource trailer, List<Resource> drivers) {
        List<Resource> out = new ArrayList<>();
        for (Resource res : new Resource[] {truck, trailer}) {
            if (res != null && res.usable()) {
                out.add(res);
            }
        }
        drivers.stream().filter(Resource::usable).forEach(out::add);
        return out;
    }

    private static StageView stage(TripView trip, String type) {
        return trip.stages().stream().filter(s -> s.stageType().equals(type)).findFirst().orElse(null);
    }

    private static boolean differs(OffsetDateTime current, OffsetDateTime wanted) {
        return current == null || Duration.between(current, wanted).abs().compareTo(SAME_TIME) >= 0;
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
    }

    private static OffsetDateTime utc(OffsetDateTime t) {
        return t == null ? null : t.withOffsetSameInstant(ZoneOffset.UTC);
    }

    private String write(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not write JSON", e);
        }
    }

    private FeedServiceRequest read(String text) {
        try {
            return json.readValue(text, FeedServiceRequest.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not read the stored desired state", e);
        }
    }

    /** A resource the feed names, resolved in fleet; {@code id} null when the directory does not have it. */
    private record Resource(String type, String key, UUID id, boolean active) {

        boolean usable() {
            return id != null && active;
        }

        String problem() {
            if (id == null) {
                return type + " " + key + " is not in the fleet directory";
            }
            return active ? null : type + " " + key + " is inactive";
        }
    }

    /** A place the feed names by its code, and the location that has it, if any. */
    private record Place(String code, Location found) {
    }

    /** The decision for one service and its steps, which run in order inside the service's transaction. */
    private static final class Plan {
        private final String code;
        private final OffsetDateTime evaluatedAt;
        private final List<String> notes = new ArrayList<>();
        private final List<Runnable> steps = new ArrayList<>();
        private final List<String> warnings = new ArrayList<>();
        private final List<String> errors = new ArrayList<>();
        private final Map<String, String> locationIds = new LinkedHashMap<>();
        private final Set<String> creating = new HashSet<>();
        private String action;
        private boolean open;
        private String mandateId;
        private String tripId;

        private Plan(String code, OffsetDateTime evaluatedAt) {
            this.code = code;
            this.evaluatedAt = evaluatedAt;
        }

        String locationId(Place place) {
            return place == null ? null : locationIds.get(place.code());
        }

        void step(String note, Runnable run) {
            notes.add(note);
            steps.add(run);
        }

        Plan decided(String action, boolean open) {
            this.action = action;
            this.open = open;
            return this;
        }

        boolean isOpen() {
            return open;
        }

        void run() {
            steps.forEach(Runnable::run);
        }

        FeedResult result(boolean dryRun) {
            return new FeedResult(code, action, dryRun, mandateId, tripId, List.copyOf(notes), List.copyOf(warnings),
                    List.copyOf(errors));
        }
    }
}
