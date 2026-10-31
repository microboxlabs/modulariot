package com.microboxlabs.miot.trips.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.core.db.PgTx;
import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.trips.domain.Assignment;
import com.microboxlabs.miot.trips.domain.CargoUnit;
import com.microboxlabs.miot.trips.domain.FeedProfile;
import com.microboxlabs.miot.trips.domain.FeedService;
import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.domain.Mandate;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.domain.TripMilestone;
import com.microboxlabs.miot.trips.domain.TripRef;
import com.microboxlabs.miot.trips.events.TripEvents;
import com.microboxlabs.miot.trips.dto.AssignmentRequest;
import com.microboxlabs.miot.trips.dto.AssignmentView;
import com.microboxlabs.miot.trips.dto.CargoRequest;
import com.microboxlabs.miot.trips.dto.FeedResult;
import com.microboxlabs.miot.trips.dto.FeedServiceRequest;
import com.microboxlabs.miot.trips.dto.MandateRequest;
import com.microboxlabs.miot.trips.dto.StageRequest;
import com.microboxlabs.miot.trips.dto.StageView;
import com.microboxlabs.miot.trips.dto.TripCargoRequest;
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
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
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
 * feed declares the plan; the trip's monitor starts and closes its stages and closes the mandate. The actual
 * departure, arrival and closure the feed sends confirm those milestones of the trip. A service that already ended
 * and carries its actual departure and closure is recorded as a regularized trip, without a monitor. A closed trip
 * is not changed: a change to it is reported.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class FeedReconciler {

    public static final String CREATE = "create";
    public static final String UPDATE = "update";
    public static final String SKIP = "skip";
    public static final String REGULARIZE = "regularize";
    /** Audited when the feed changes a trip that is already closed. */
    public static final String CLOSED_CHANGED = "feed.closed_changed";
    public static final String REPORT = "report";
    public static final String ERROR = "error";
    /** Accepted from the feed, not applied yet. */
    public static final String PENDING = "pending";

    private static final Duration SAME_TIME = Duration.ofMinutes(1);
    private static final String TRUCK = Assignment.TRUCK;
    private static final String TRAILER = Assignment.TRAILER;
    private static final String DRIVER = Assignment.DRIVER;
    private static final String EXTERNAL_CODE = "externalCode";

    private final FeedStore feeds;
    private final MandateService mandates;
    private final TripService trips;
    private final StageService stages;
    private final AssignmentService assignments;
    private final LocationService locations;
    private final MilestoneService milestones;
    private final AuditService audit;
    private final TripEvents events;
    private final FleetResources fleet;
    private final Transactions tx;
    private final ObjectMapper json;
    private final Clock clock;
    /** Null where the feed's cargo is not applied (tests without cargo). */
    private CargoService cargo;
    private TripCargoService mounts;

    @Inject
    @SuppressWarnings("java:S107")
    FeedReconciler(FeedStore feeds, MandateService mandates, TripService trips, StageService stages,
            AssignmentService assignments, LocationService locations, MilestoneService milestones,
            AuditService audit, TripEvents events, FleetResources fleet, Transactions tx, ObjectMapper json,
            CargoService cargo, TripCargoService mounts) {
        this(feeds, mandates, trips, stages, assignments, locations, milestones, audit, events, fleet, tx, json,
                Clock.systemUTC());
        this.cargo = cargo;
        this.mounts = mounts;
    }

    /** With the services that announce the feed's cargo and mount it on the trip. */
    @SuppressWarnings("java:S107")
    public FeedReconciler(FeedStore feeds, MandateService mandates, TripService trips, StageService stages,
            AssignmentService assignments, LocationService locations, MilestoneService milestones,
            AuditService audit, FleetResources fleet, Transactions tx, ObjectMapper json, Clock clock,
            CargoService cargo, TripCargoService mounts) {
        this(feeds, mandates, trips, stages, assignments, locations, milestones, audit, fleet, tx, json, clock);
        this.cargo = cargo;
        this.mounts = mounts;
    }

    /** Without trip events. */
    @SuppressWarnings("java:S107")
    public FeedReconciler(FeedStore feeds, MandateService mandates, TripService trips, StageService stages,
            AssignmentService assignments, LocationService locations, MilestoneService milestones,
            AuditService audit, FleetResources fleet, Transactions tx, ObjectMapper json, Clock clock) {
        this(feeds, mandates, trips, stages, assignments, locations, milestones, audit, TripEvents.NONE, fleet, tx,
                json, clock);
    }

    // Mirrors CDI dependencies while allowing a deterministic clock in tests.
    @SuppressWarnings("java:S107")
    public FeedReconciler(FeedStore feeds, MandateService mandates, TripService trips, StageService stages,
            AssignmentService assignments, LocationService locations, MilestoneService milestones,
            AuditService audit, TripEvents events, FleetResources fleet, Transactions tx, ObjectMapper json,
            Clock clock) {
        this.feeds = feeds;
        this.mandates = mandates;
        this.trips = trips;
        this.stages = stages;
        this.assignments = assignments;
        this.locations = locations;
        this.milestones = milestones;
        this.audit = audit;
        this.events = events;
        this.fleet = fleet;
        this.tx = tx;
        this.json = json;
        this.clock = clock;
    }

    /** The feed's profile; 404 when the tenant has no such feed, 409 when it is switched off. */
    public FeedProfile profile(String tenantCode, String feedKey) {
        FeedProfile profile = feeds.profile(tenantCode, feedKey)
                .orElseThrow(() -> new NoSuchElementException("feed " + feedKey + " not found"));
        if (!profile.active()) {
            throw new IllegalStateException("feed " + feedKey + " is inactive");
        }
        return profile;
    }

    /** The hash of the desired state, without {@code source}: the same hash means nothing to apply. */
    public String hash(FeedServiceRequest desired) {
        FeedServiceRequest compared = new FeedServiceRequest(desired.orderType(), desired.orderRef(),
                desired.origin(), desired.destination(), utc(desired.plannedStart()), utc(desired.plannedEnd()),
                utc(desired.actualStart()), utc(desired.actualArrival()), utc(desired.actualEnd()),
                desired.resourcesOrEmpty(), null, reports(desired.milestones()), desired.slaMinutes(),
                desired.cargo(), desired.originSite(), desired.destinationSite());
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
        String code = Check.required(externalCode, EXTERNAL_CODE, 128);
        if (desired == null) {
            throw new IllegalArgumentException("body is required");
        }
        FeedProfile profile = profile(tenantCode, feedKey);
        if (dryRun) {
            FeedServiceRequest previous = feeds.service(tenantCode, feedKey, code).map(FeedService::appliedDesired)
                    .map(this::readOrNull).orElse(null);
            return plan(tenantCode, actor, profile, code, desired, previous).result(true);
        }
        return applyLocked(tenantCode, actor, profile, code, desired, false);
    }

    /** The digests of the services of {@code externalCodes} that exist, by code, in one read. */
    public Map<String, FeedService.Digest> digests(String tenantCode, String feedKey,
            Collection<String> externalCodes) {
        return feeds.digests(tenantCode, feedKey, externalCodes);
    }

    /**
     * Whether a batch can skip {@code desired} without a transaction: the service is closed and {@code desired} is
     * the state already applied. An open service still goes through {@link #accept}, which checks its trip.
     */
    public boolean settled(FeedService.Digest digest, FeedServiceRequest desired) {
        return digest != null && desired != null && !digest.open() && !REPORT.equals(digest.lastAction())
                && hash(desired).equals(digest.desiredHash());
    }

    /**
     * Keeps {@code desired} as the service's latest state, to be applied by {@link #recheck}. Returns false when it
     * is the state already applied or waiting: nothing new to apply.
     */
    public boolean accept(String tenantCode, String feedKey, String externalCode, FeedServiceRequest desired) {
        String code = Check.required(externalCode, EXTERNAL_CODE, 128);
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
                    before.tripId(), true, PENDING, before.lastResult(), before.lastReconciledAt(),
                    before.appliedDesired()));
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
                    SKIP, write(result), now(), service.appliedDesired()));
        }
    }

    /** Applies the service's latest desired state, after {@link #accept}. */
    public FeedResult recheck(String tenantCode, String actor, String feedKey, String externalCode) {
        return applyLocked(tenantCode, actor, profile(tenantCode, feedKey), externalCode, null, true);
    }

    public FeedResult recheck(String tenantCode, String feedKey, String externalCode) {
        return recheck(tenantCode, "feed:" + feedKey + ":clock", feedKey, externalCode);
    }

    /** The service's latest desired state, or null when there is none. */
    public FeedServiceRequest desired(String tenantCode, String feedKey, String externalCode) {
        return feeds.service(tenantCode, feedKey, externalCode).map(FeedService::desired).map(this::readOrNull)
                .orElse(null);
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
            return attempt(tenantCode, actor, profile, code, before, desired);
        });
        if (attempt.failure() != null) {
            throw attempt.failure();
        }
        return attempt.result();
    }

    private Attempt attempt(String tenantCode, String actor, FeedProfile profile, String code, FeedService before,
            FeedServiceRequest desired) {
        try {
            return PgTx.savepoint(() -> applyPlan(tenantCode, actor, profile, code, before, desired));
        } catch (RuntimeException failure) {
            // The business changes roll back to the savepoint; the service row remains locked.
            recordFailure(before, desired, failure);
            return new Attempt(null, failure);
        }
    }

    private Attempt applyPlan(String tenantCode, String actor, FeedProfile profile, String code, FeedService before,
            FeedServiceRequest desired) {
        Plan plan = plan(tenantCode, actor, profile, code, desired, readOrNull(before.appliedDesired()));
        plan.run();
        FeedResult result = plan.result(false);
        feeds.saveService(new FeedService(tenantCode, profile.feedKey(), code, write(desired), hash(desired),
                plan.mandateId != null ? plan.mandateId : before.mandateId(),
                plan.tripId != null ? plan.tripId : before.tripId(), plan.isOpen(), plan.action,
                write(result), plan.evaluatedAt,
                REPORT.equals(plan.action) ? before.appliedDesired() : write(desired)));
        return new Attempt(result, null);
    }

    private void recordFailure(FeedService before, FeedServiceRequest desired, RuntimeException failure) {
        FeedResult failed = new FeedResult(before.externalCode(), ERROR, false, before.mandateId(), before.tripId(),
                List.of(), List.of(), List.of(String.valueOf(failure.getMessage())));
        feeds.saveService(new FeedService(before.tenantCode(), before.feedKey(), before.externalCode(),
                write(desired), "", before.mandateId(), before.tripId(), true, ERROR, write(failed), now(),
                before.appliedDesired()));
    }

    // ---------------------------------------------------------------- reading and deciding

    private Plan plan(String tenantCode, String actor, FeedProfile profile, String code, FeedServiceRequest d,
            FeedServiceRequest previous) {
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

        ResolvedResources resources = resolveResources(tenantCode, d, profile);
        Resource truck = resources.truck();
        Resource trailer = resources.trailer();
        List<Resource> drivers = resources.drivers();
        Place origin = place(tenantCode, d.origin());
        Place destination = place(tenantCode, d.destination());

        OffsetDateTime endedAt = d.actualEnd() != null ? d.actualEnd() : d.plannedEnd();
        boolean ended = endedAt != null && !endedAt.isAfter(now);

        PlanningContext context = new PlanningContext(tenantCode, actor, profile, d, trip == null && ended);
        if (trip != null && finished(trip, mandate)) {
            planClosedChanges(plan, tenantCode, actor, code, trip, d, previous);
            int reported = plan.steps.size();
            planMilestones(plan, tenantCode, actor, trip, d);
            // a closed trip only records milestones; a change to it is reported, not applied
            return plan.decided(plan.steps.size() > reported ? UPDATE : SKIP, false);
        }
        if (finished(trip, mandate)) {
            return plan.decided(SKIP, false);
        }
        if (context.regularized()) {
            return planRegularizedService(plan, context, code, mandate.orElse(null), resources, origin, destination);
        }
        if (trip == null) {
            return planNewService(plan, context, code, mandate.orElse(null), resources, origin, destination);
        }
        List<Resource> named = new ArrayList<>(drivers);
        named.add(0, trailer);
        named.add(0, truck);
        warnAbout(plan, named);
        if (!planRegistrations(plan, tenantCode, actor, resources)) {
            return plan.decided(REPORT, true);
        }
        planPlaces(plan, tenantCode, actor, origin, destination);
        planRoute(plan, tenantCode, actor, trip, origin, destination);
        planChanges(plan, context, mandate.orElseThrow(), trip, resources);
        planMilestones(plan, tenantCode, actor, trip, d);
        return plan.decided(UPDATE, true);
    }

    private Plan planNewService(Plan plan, PlanningContext context, String code, Mandate mandate,
            ResolvedResources resources, Place origin, Place destination) {
        List<String> missing = missingResources(context.profile(), context.desired(), resources);
        if (!missing.isEmpty()) {
            plan.errors.addAll(missing);
            return plan.decided(REPORT, true);
        }
        warnAboutOptionalResources(plan, context.profile(), resources);
        if (!planRegistrations(plan, context.tenantCode(), context.actor(), resources)) {
            return plan.decided(REPORT, true);
        }
        planPlaces(plan, context.tenantCode(), context.actor(), origin, destination);
        planCreate(plan, context, code, mandate, resources, origin, destination);
        planMilestones(plan, context.tenantCode(), context.actor(), null, context.desired());
        return plan.decided(CREATE, true);
    }

    private Plan planRegularizedService(Plan plan, PlanningContext context, String code, Mandate mandate,
            ResolvedResources resources, Place origin, Place destination) {
        FeedServiceRequest desired = context.desired();
        if (desired.actualStart() == null || desired.actualEnd() == null) {
            plan.warnings.add("the service ended before the feed sent it; send its actual departure and"
                    + " closure to record it");
            return plan.decided(SKIP, false);
        }
        if (!chronologicalActuals(desired)) {
            plan.errors.add("actual departure, arrival and closure must be in chronological order");
            return plan.decided(REPORT, true);
        }
        FeedProfile profile = context.profile();
        if (!"closing".equals(profile.stages().get(profile.stages().size() - 1).stageType())) {
            plan.errors.add("a regularized trip requires closing as its final stage");
            return plan.decided(REPORT, true);
        }
        String tenantCode = context.tenantCode();
        String actor = context.actor();
        if (!planRegistrations(plan, tenantCode, actor, resources)) {
            return plan.decided(REPORT, true);
        }
        planPlaces(plan, tenantCode, actor, origin, destination);
        planCreate(plan, context, code, mandate, resources, origin, destination);
        planMilestones(plan, tenantCode, actor, null, desired);
        planRegularized(plan, tenantCode, actor, profile, desired);
        return plan.decided(REGULARIZE, false);
    }

    /** {@code regularized}: the service ended before the feed sent it, so its trip is recorded, not run. */
    private record PlanningContext(String tenantCode, String actor, FeedProfile profile,
            FeedServiceRequest desired, boolean regularized) {
    }

    /** {@code carrier} is the vehicles' carrier when the feed sent one; registrations use it. */
    private record ResolvedResources(Resource truck, Resource trailer, List<Resource> drivers, boolean clearDrivers,
            FeedServiceRequest.Carrier carrier) {

        List<Resource> named() {
            List<Resource> out = new ArrayList<>();
            out.add(truck);
            out.add(trailer);
            out.addAll(drivers);
            out.removeIf(Objects::isNull);
            return out;
        }
    }

    private ResolvedResources resolveResources(String tenantCode, FeedServiceRequest desired, FeedProfile profile) {
        FeedServiceRequest.Resources r = desired.resourcesOrEmpty();
        FeedServiceRequest.Carrier carrier = r.carrier() == null || r.carrier().taxId() == null
                || r.carrier().taxId().isBlank() ? null : r.carrier();
        boolean registers = profile.registersResources();
        List<Resource> drivers = r.drivers() == null ? List.of() : r.drivers().stream()
                .filter(k -> k != null && !k.isBlank())
                .collect(java.util.stream.Collectors.toMap(FeedServiceRequest.Resources::key, document -> document,
                        (first, duplicate) -> first, LinkedHashMap::new)).values().stream()
                .map(k -> resolve(tenantCode, DRIVER, k)).toList();
        Resource truck = resolve(tenantCode, TRUCK, r.truck());
        Resource trailer = resolve(tenantCode, TRAILER, r.trailer());
        for (Resource vehicle : new Resource[] {truck, trailer}) {
            prepareVehicleRegistration(vehicle, registers, carrier);
        }
        for (Resource driver : drivers) {
            if (driver.id == null && registers) {
                driver.registration = Registration.READY;
                driver.details = r.detailsOf(driver.key());
            }
        }
        return new ResolvedResources(truck, trailer, drivers,
                desired.resources() != null && r.drivers() != null && r.drivers().isEmpty(), carrier);
    }

    private static void prepareVehicleRegistration(Resource vehicle, boolean registers,
            FeedServiceRequest.Carrier carrier) {
        if (vehicle != null && vehicle.id == null && registers) {
            vehicle.registration = carrier == null ? Registration.NEEDS_CARRIER : Registration.READY;
        }
    }

    /**
     * Steps that add to fleet the resources it lacks, before anything uses them: the carrier (found by tax id or
     * registered) when a vehicle needs it, then the vehicles, then the drivers, linked to that carrier when there is
     * one. Each step sets the resource's id, which the later steps read.
     */
    private boolean planRegistrations(Plan plan, String tenantCode, String actor, ResolvedResources resources) {
        List<Resource> pending = resources.named().stream().filter(Resource::pending).toList();
        if (pending.isEmpty()) {
            return true;
        }
        FeedServiceRequest.Carrier carrier = resources.carrier();
        UUID[] carrierId = new UUID[1];
        if (carrier != null) {
            if (fleet.carrierByTaxId(tenantCode, carrier.taxId()).filter(found -> !found.active()).isPresent()) {
                plan.errors.add("carrier " + carrier.taxId() + " is inactive");
                return false;
            }
            String label = carrier.name() == null || carrier.name().isBlank() ? carrier.taxId() : carrier.name();
            plan.step("find or register carrier " + label,
                    () -> carrierId[0] = findOrRegisterCarrier(tenantCode, actor, carrier));
        }
        for (Resource resource : pending) {
            planRegistration(plan, tenantCode, actor, resource, carrierId);
        }
        return true;
    }

    private void planRegistration(Plan plan, String tenantCode, String actor, Resource resource, UUID[] carrierId) {
        if (DRIVER.equals(resource.type())) {
            FeedServiceRequest.Person who = resource.details;
            plan.step("register driver " + resource.key(), () -> resource.id = fleet.registerDriver(tenantCode, actor,
                    resource.key(), who == null ? null : blankToNull(who.name()),
                    who == null ? null : blankToNull(who.phone()), carrierId[0]));
        } else {
            plan.step("register " + resource.type() + " " + resource.key(), () -> resource.id = fleet.registerVehicle(
                    tenantCode, actor, resource.type(), resource.key(), carrierId[0]));
        }
    }

    private UUID findOrRegisterCarrier(String tenantCode, String actor, FeedServiceRequest.Carrier carrier) {
        Optional<FleetResources.Match> found = fleet.carrierByTaxId(tenantCode, carrier.taxId());
        if (found.isPresent() && !found.get().active()) {
            throw new IllegalStateException("carrier " + carrier.taxId() + " is inactive");
        }
        return found.map(FleetResources.Match::id)
                .orElseGet(() -> fleet.registerCarrier(tenantCode, actor, carrier.taxId(), carrier.name()));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
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

    /** How a resource fleet lacks gets there: it cannot, it can now, or it could with a carrier. */
    private enum Registration { NONE, READY, NEEDS_CARRIER }

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
        OffsetDateTime plannedStart = d.plannedStart() != null ? d.plannedStart() : d.actualStart();
        OffsetDateTime plannedEnd = d.plannedEnd() != null ? d.plannedEnd() : d.actualEnd();
        if (mandate == null) {
            plan.step("create mandate " + code, () -> plan.mandateId = mandates.createOrGet(tenantCode, actor,
                    new MandateRequest(code, d.orderType(), d.orderRef(), plan.locationId(origin),
                            plan.locationId(destination), d.slaMinutes())).mandate().id());
        }
        List<FeedProfile.StagePlan> planned = profile.stages();
        plan.step("create trip with stages " + planned.stream().map(FeedProfile.StagePlan::stageType).toList(), () -> {
            List<StageRequest> initialStages = stageRequests(profile, plannedEnd);
            TripRequest request = new TripRequest(plan.locationId(origin),
                    plan.locationId(destination), plannedStart, List.of(plan.mandateId), initialStages, null);
            TripView created = context.regularized() ? trips.createRegularized(tenantCode, actor, request)
                    : trips.createFromFeed(tenantCode, actor, request, profile.feedKey());
            plan.tripId = created.id();
        });
        for (Resource res : assignable(truck, trailer, drivers)) {
            plan.step("assign " + res.type() + " " + res.key(), () -> assignments.create(tenantCode, actor,
                    UUID.fromString(plan.tripId), new AssignmentRequest(res.type(), res.id().toString(),
                            context.regularized() ? d.actualStart() : null, null)));
        }
        if (mandate != null && d.slaMinutes() != null && !d.slaMinutes().equals(mandate.slaMinutes())) {
            planSla(plan, tenantCode, actor, mandate, d.slaMinutes());
        }
        planCargo(plan, context,
                mandate == null || cargo == null ? List.of()
                        : cargo.listByMandate(tenantCode, UUID.fromString(mandate.id())),
                d.cargo(), Set.of());
    }

    private static List<StageRequest> stageRequests(FeedProfile profile, OffsetDateTime plannedEnd) {
        return profile.stages().stream().map(s -> new StageRequest(s.stageType(), s.serviceStatus(), null, null,
                s.stageType().equals(profile.arrivalStage()) ? plannedEnd : null, null)).toList();
    }

    private void planSla(Plan plan, String tenantCode, String actor, Mandate mandate, Integer minutes) {
        plan.step("change SLA to " + minutes + " minutes", () -> mandates.update(tenantCode, actor,
                UUID.fromString(mandate.id()), new MandateRequest(null, null, null, null, null, minutes)));
    }

    /**
     * Matches the feed's cargo to the mandate's units by position: a changed unit is updated, a new one is
     * announced and mounted on the trip. Units the feed no longer sends are kept and reported.
     */
    private void planCargo(Plan plan, PlanningContext context, List<CargoUnit> current,
            List<FeedServiceRequest.CargoItem> wanted, Set<String> mounted) {
        if (wanted.isEmpty()) {
            return;
        }
        if (cargo == null || mounts == null) {
            plan.warnings.add("cargo is not applied here");
            return;
        }
        for (int i = 0; i < wanted.size(); i++) {
            planCargoUnit(plan, context, i + 1, i < current.size() ? current.get(i) : null, wanted.get(i), mounted);
        }
        if (current.size() > wanted.size()) {
            plan.warnings.add("cargo " + (wanted.size() + 1) + ".." + current.size()
                    + " no longer sent; kept");
        }
    }

    private void planCargoUnit(Plan plan, PlanningContext context, int position, CargoUnit unit,
            FeedServiceRequest.CargoItem item, Set<String> mounted) {
        String tenant = context.tenantCode();
        String actor = context.actor();
        CargoRequest request = new CargoRequest(item.description(), item.qty(), item.qtyUnit(),
                item.weightKg(), item.volumeM3(), null);
        if (unit == null) {
            plan.step("announce and mount cargo " + position, () -> {
                CargoUnit announced = cargo.announce(tenant, actor, UUID.fromString(plan.mandateId), request);
                mounts.mount(tenant, actor, UUID.fromString(plan.tripId),
                        new TripCargoRequest(announced.id(), null, null));
            });
            return;
        }
        if (!sameCargo(unit, item)) {
            plan.step("update cargo " + position, () -> cargo.update(tenant, actor, UUID.fromString(unit.id()),
                    request));
        }
        if (!mounted.contains(unit.id())) {
            plan.step("mount cargo " + position, () -> mounts.mount(tenant, actor, UUID.fromString(plan.tripId),
                    new TripCargoRequest(unit.id(), null, null)));
        }
    }

    private static boolean sameCargo(CargoUnit unit, FeedServiceRequest.CargoItem item) {
        String description = item.description() == null || item.description().isBlank() ? unit.description()
                : Check.required(item.description(), "description", 500);
        return Objects.equals(unit.description(), description)
                && (item.qty() == null || sameNumber(unit.qty(), item.qty()))
                && Objects.equals(unit.qtyUnit(), Check.orKeep(item.qtyUnit(), unit.qtyUnit(), "qtyUnit", 32))
                && (item.weightKg() == null || sameNumber(unit.weightKg(), item.weightKg()))
                && (item.volumeM3() == null || sameNumber(unit.volumeM3(), item.volumeM3()));
    }

    private static boolean sameNumber(java.math.BigDecimal a, java.math.BigDecimal b) {
        return a == null ? b == null : b != null && a.compareTo(b) == 0;
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
        if (d.slaMinutes() != null && !d.slaMinutes().equals(mandate.slaMinutes())) {
            planSla(plan, tenantCode, actor, mandate, d.slaMinutes());
        }
        planAssignments(plan, tenantCode, actor, trip, resources);
        Set<String> mounted = new HashSet<>();
        if (trip.cargo() != null) {
            trip.cargo().forEach(unit -> mounted.add(unit.cargoId()));
        }
        planCargo(plan, context,
                cargo == null ? List.of() : cargo.listByMandate(tenantCode, UUID.fromString(mandate.id())),
                d.cargo(), mounted);
    }

    /**
     * Confirms the milestones the feed sends an actual time for. One already confirmed at that time is left alone;
     * at another time the first confirmation stays and the difference is reported.
     */
    private void planMilestones(Plan plan, String tenantCode, String actor, TripView trip, FeedServiceRequest d) {
        Map<String, OffsetDateTime> actual = new LinkedHashMap<>();
        actual.put(TripMilestone.DEPARTURE, d.actualStart());
        actual.put(TripMilestone.ARRIVAL, d.actualArrival());
        actual.put(TripMilestone.CLOSURE, d.actualEnd());
        Map<String, TripMilestone> recorded = new LinkedHashMap<>();
        if (trip != null) {
            milestones.list(tenantCode, UUID.fromString(trip.id())).forEach(m -> recorded.put(m.milestone(), m));
        }
        d.milestones().keySet().forEach(name -> {
            if (!TripMilestone.MILESTONES.contains(name)) {
                throw new IllegalArgumentException("milestones: " + name + " is not one of "
                        + TripMilestone.MILESTONES);
            }
        });
        for (String name : TripMilestone.MILESTONES) {
            FeedServiceRequest.MilestoneReport report = d.milestones().get(name);
            Map<String, Object> metadata = reportEvidence(report);
            OffsetDateTime at = actual.get(name);
            if (at != null) {
                planMilestone(plan, tenantCode, actor, name, at, metadata, recorded.get(name));
            }
            if (d.milestones().containsKey(name) && separateReport(at, report)) {
                planMilestone(plan, tenantCode, actor, name, report == null ? null : report.at(), metadata,
                        recorded.get(name));
            }
        }
    }

    private void planMilestone(Plan plan, String tenantCode, String actor, String name, OffsetDateTime at,
            Map<String, Object> metadata, TripMilestone current) {
        if (at != null || current != null && current.isConfirmed()) {
            planMilestoneConfirmation(plan, tenantCode, actor, name, at, metadata, current);
            return;
        }
        if (current == null || TripMilestone.OPEN.equals(current.status()) || !knownEvidence(current, metadata)) {
            plan.step("report " + name + " with " + metadata.size() + " metadata",
                    () -> milestones.detect(tenantCode, actor, UUID.fromString(plan.tripId), name, "feed", null,
                            metadata));
        }
    }

    private void planMilestoneConfirmation(Plan plan, String tenantCode, String actor, String name,
            OffsetDateTime at, Map<String, Object> metadata, TripMilestone current) {
        String operation = at == null ? "merge " + name + " metadata" : "confirm " + name + " at " + utc(at);
        if (current != null && current.isConfirmed()) {
            if ((at == null || sameMilestoneTime(current.confirmedAt(), at)) && knownEvidence(current, metadata)) {
                return;
            }
            if (at != null && !sameMilestoneTime(current.confirmedAt(), at)) {
                plan.warnings.add(name + " was confirmed at " + current.confirmedAt() + "; the feed says " + utc(at));
                operation = "report conflicting " + name + " at " + utc(at);
            }
        }
        plan.step(operation, () -> milestones.confirm(tenantCode, actor, UUID.fromString(plan.tripId), name, at,
                "feed", null, metadata));
    }

    private static Map<String, Object> reportEvidence(FeedServiceRequest.MilestoneReport report) {
        return report == null || report.evidence() == null ? Map.of() : report.evidence();
    }

    private static boolean separateReport(OffsetDateTime actual, FeedServiceRequest.MilestoneReport report) {
        return actual == null || report != null && report.at() != null && !sameMilestoneTime(actual, report.at());
    }

    private static boolean knownEvidence(TripMilestone current, Map<String, Object> metadata) {
        return current != null && current.evidence().entrySet().containsAll(metadata.entrySet());
    }

    private static boolean sameMilestoneTime(OffsetDateTime first, OffsetDateTime second) {
        return first != null && second != null && first.toInstant().truncatedTo(ChronoUnit.MICROS)
                .equals(second.toInstant().truncatedTo(ChronoUnit.MICROS));
    }

    /** The reports with their times in UTC, for the hash. */
    private static Map<String, FeedServiceRequest.MilestoneReport> reports(
            Map<String, FeedServiceRequest.MilestoneReport> in) {
        Map<String, FeedServiceRequest.MilestoneReport> out = new java.util.TreeMap<>();
        in.forEach((k, v) -> out.put(k, v == null ? null
                : new FeedServiceRequest.MilestoneReport(utc(v.at()), sorted(v.evidence()))));
        return out;
    }

    @SuppressWarnings("unchecked")
    private static <T> T sorted(T value) {
        if (value instanceof Map<?, ?> m) {
            Map<String, Object> out = new java.util.TreeMap<>();
            m.forEach((k, v) -> out.put(String.valueOf(k), sorted(v)));
            return (T) out;
        }
        if (value instanceof List<?> l) {
            return (T) l.stream().map(FeedReconciler::sorted).toList();
        }
        return value;
    }

    /**
     * Runs the stages of a regularized trip through at the times the feed gives: the first starts at the actual
     * departure, the arrival stage ends at the actual arrival (else the closure), the last ends at the closure.
     * Stages in between take the nearest of those times. Then the mandate closes.
     */
    private void planRegularized(Plan plan, String tenantCode, String actor, FeedProfile profile,
            FeedServiceRequest d) {
        plan.step("record the trip as run", () -> {
            UUID tripId = UUID.fromString(plan.tripId);
            List<StageView> ordered = trips.detail(tenantCode, tripId).stages().stream()
                    .sorted(Comparator.comparingInt(StageView::seq)).toList();
            int arrival = -1;
            for (int i = 0; i < ordered.size(); i++) {
                if (ordered.get(i).stageType().equals(profile.arrivalStage())) {
                    arrival = i;
                }
            }
            OffsetDateTime departed = d.actualStart();
            OffsetDateTime arrived = d.actualArrival() != null ? d.actualArrival() : d.actualEnd();
            for (int i = 0; i < ordered.size(); i++) {
                UUID stageId = UUID.fromString(ordered.get(i).id());
                OffsetDateTime start = arrival < 0 || i <= arrival ? departed : arrived;
                OffsetDateTime end = regularizedEnd(i, ordered.size(), arrival, departed, arrived, d.actualEnd());
                stages.start(tenantCode, actor, stageId, start);
                stages.close(tenantCode, actor, stageId, end);
            }
        });
        plan.step("close mandate", () -> mandates.close(tenantCode, actor, UUID.fromString(plan.mandateId)));
    }

    private static OffsetDateTime regularizedEnd(int i, int count, int arrival, OffsetDateTime departed,
            OffsetDateTime arrived, OffsetDateTime closed) {
        if (i == count - 1) {
            return closed;
        }
        if (arrival < 0 || i < arrival) {
            return departed;
        }
        return arrived;
    }

    private static boolean chronologicalActuals(FeedServiceRequest desired) {
        if (desired.actualEnd().isBefore(desired.actualStart())) {
            return false;
        }
        OffsetDateTime arrival = desired.actualArrival();
        return arrival == null || (!arrival.isBefore(desired.actualStart()) && !arrival.isAfter(desired.actualEnd()));
    }

    /** A closed trip is not changed: what the feed changed on it is reported and audited. */
    private void planClosedChanges(Plan plan, String tenantCode, String actor, String code, TripView trip,
            FeedServiceRequest d, FeedServiceRequest previous) {
        List<String> changed = changedFields(previous, d);
        if (changed.isEmpty()) {
            return;
        }
        plan.warnings.add("the trip is " + trip.status() + "; the feed changed " + String.join(", ", changed)
                + ", which is not applied");
        plan.step("report the change to a closed trip", () -> {
            audit.log(tenantCode, actor, CLOSED_CHANGED, "trip", trip.id(), null,
                    Map.of(EXTERNAL_CODE, code, "fields", changed, "status", trip.status()));
            events.closedChanged(tenantCode, trip.id(), now().toInstant(), changed, actor);
        });
    }

    /** The planned fields the feed changed since its last send; the actual times are milestones, not changes. */
    static List<String> changedFields(FeedServiceRequest before, FeedServiceRequest after) {
        if (before == null) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        if (!Objects.equals(before.orderType(), after.orderType())) {
            out.add("orderType");
        }
        if (!Objects.equals(before.orderRef(), after.orderRef())) {
            out.add("orderRef");
        }
        if (!Objects.equals(before.origin(), after.origin())) {
            out.add("origin");
        }
        if (!Objects.equals(before.destination(), after.destination())) {
            out.add("destination");
        }
        if (!sameTime(before.plannedStart(), after.plannedStart())) {
            out.add("plannedStart");
        }
        if (!sameTime(before.plannedEnd(), after.plannedEnd())) {
            out.add("plannedEnd");
        }
        if (!Objects.equals(before.resourcesOrEmpty(), after.resourcesOrEmpty())) {
            out.add("resources");
        }
        if (after.slaMinutes() != null && !Objects.equals(before.slaMinutes(), after.slaMinutes())) {
            out.add("slaMinutes");
        }
        if (!after.cargo().isEmpty() && !Objects.equals(before.cargo(), after.cargo())) {
            out.add("cargo");
        }
        return out;
    }

    private static boolean sameTime(OffsetDateTime a, OffsetDateTime b) {
        return a == null ? b == null : b != null && a.isEqual(b);
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
                .collect(java.util.stream.Collectors.toMap(Resource::identity, resource -> resource,
                        (first, duplicate) -> first, LinkedHashMap::new)).values().stream().toList();
        if (wanted.isEmpty() && !resources.clearDrivers()) {
            return;
        }
        List<AssignmentView> openDrivers = open.stream().filter(a -> DRIVER.equals(a.resourceType())).toList();
        int retained = 0;
        while (retained < openDrivers.size() && retained < wanted.size()
                && openDrivers.get(retained).resourceId().equals(wanted.get(retained).identity())) {
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
        if (current.isPresent() && current.get().resourceId().equals(res.identity())) {
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

    private FeedServiceRequest readOrNull(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            return read(text);
        } catch (IllegalStateException e) {
            return null;
        }
    }

    private FeedServiceRequest read(String text) {
        try {
            return json.readValue(text, FeedServiceRequest.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not read the stored desired state", e);
        }
    }

    /**
     * A resource the feed names, resolved in fleet; {@code id} null when the directory does not have it. A resource
     * the feed registers gets its id from its registration step, which runs before the steps that use it.
     */
    private static final class Resource {
        private final String type;
        private final String key;
        private final boolean active;
        private UUID id;
        private Registration registration = Registration.NONE;
        private FeedServiceRequest.Person details;

        Resource(String type, String key, UUID id, boolean active) {
            this.type = type;
            this.key = key;
            this.id = id;
            this.active = active;
        }

        String type() {
            return type;
        }

        String key() {
            return key;
        }

        UUID id() {
            return id;
        }

        /** Not in fleet yet, and registered by this service. */
        boolean pending() {
            return id == null && registration == Registration.READY;
        }

        boolean usable() {
            return (id != null && active) || pending();
        }

        /** Tells apart two resources: by id, or by key while it waits for its registration. */
        String identity() {
            return id != null ? id.toString() : type + ":" + FeedServiceRequest.Resources.key(key);
        }

        String problem() {
            if (id == null) {
                return switch (registration) {
                    case READY -> null;
                    case NEEDS_CARRIER -> type + " " + key + " is not in the fleet directory; send its carrier's"
                            + " tax id to register it";
                    case NONE -> type + " " + key + " is not in the fleet directory";
                };
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
