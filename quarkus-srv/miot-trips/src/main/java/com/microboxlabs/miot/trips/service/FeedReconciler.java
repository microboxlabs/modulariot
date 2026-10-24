package com.microboxlabs.miot.trips.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.trips.domain.Assignment;
import com.microboxlabs.miot.trips.domain.FeedProfile;
import com.microboxlabs.miot.trips.domain.FeedService;
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
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Reconciles one service of a feed with the desired state the feed sent: reads the mandate, the trip and the
 * resources, decides with the feed profile's rules, and applies the steps in one transaction through the trips
 * services, so their checks, the board and the audit apply as for any API call. A step that fails undoes the whole
 * service. {@link #recheck} runs it again with the last desired state, for the clock: departure and close.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class FeedReconciler {

    public static final String CREATE = "alta";
    public static final String UPDATE = "cambios";
    public static final String CLOSE = "cierre";
    public static final String SKIP = "omitir";
    public static final String REPORT = "reportar";
    public static final String ERROR = "error";

    private static final Duration SAME_TIME = Duration.ofMinutes(1);
    private static final String TRUCK = Assignment.TRUCK;
    private static final String TRAILER = Assignment.TRAILER;
    private static final String DRIVER = Assignment.DRIVER;

    private final FeedStore feeds;
    private final MandateService mandates;
    private final TripService trips;
    private final StageService stages;
    private final AssignmentService assignments;
    private final FleetResources fleet;
    private final Transactions tx;
    private final ObjectMapper json;
    private final Clock clock;

    @Inject
    FeedReconciler(FeedStore feeds, MandateService mandates, TripService trips, StageService stages,
            AssignmentService assignments, FleetResources fleet, Transactions tx, ObjectMapper json) {
        this(feeds, mandates, trips, stages, assignments, fleet, tx, json, Clock.systemUTC());
    }

    public FeedReconciler(FeedStore feeds, MandateService mandates, TripService trips, StageService stages,
            AssignmentService assignments, FleetResources fleet, Transactions tx, ObjectMapper json, Clock clock) {
        this.feeds = feeds;
        this.mandates = mandates;
        this.trips = trips;
        this.stages = stages;
        this.assignments = assignments;
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

    /** The hash of the desired state, without {@code source}: the same hash means nothing to apply but the clock. */
    public String hash(FeedServiceRequest desired) {
        FeedServiceRequest compared = new FeedServiceRequest(desired.orderType(), desired.orderRef(),
                utc(desired.plannedStart()), utc(desired.plannedEnd()), desired.resourcesOrEmpty(), null);
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
        try {
            return tx.inTransaction(() -> {
                FeedService before = feeds.lockService(tenantCode, feedKey, code);
                Plan plan = plan(tenantCode, actor, profile, code, desired);
                plan.run();
                FeedResult result = plan.result(false);
                feeds.saveService(new FeedService(tenantCode, feedKey, code, write(desired), hash(desired),
                        plan.mandateId != null ? plan.mandateId : before.mandateId(),
                        plan.tripId != null ? plan.tripId : before.tripId(),
                        plan.open, plan.action, write(result), now()));
                return result;
            });
        } catch (RuntimeException e) {
            recordFailure(tenantCode, feedKey, code, desired, e);
            throw e;
        }
    }

    /** Runs the service again with its last desired state, as the clock: departure and close need no new send. */
    public FeedResult recheck(String tenantCode, String feedKey, String externalCode) {
        FeedService s = feeds.service(tenantCode, feedKey, externalCode)
                .orElseThrow(() -> new NoSuchElementException("feed service " + externalCode + " not found"));
        FeedServiceRequest desired = read(s.desired());
        return reconcile(tenantCode, "feed:" + feedKey + ":clock", feedKey, externalCode, desired, false);
    }

    /** The service keeps its last desired state but no hash, so the feed's next send is applied, not skipped. */
    private void recordFailure(String tenantCode, String feedKey, String code, FeedServiceRequest desired,
            RuntimeException e) {
        try {
            tx.inTransaction(() -> {
                FeedService before = feeds.lockService(tenantCode, feedKey, code);
                FeedResult failed = new FeedResult(code, ERROR, false, before.mandateId(), before.tripId(), List.of(),
                        List.of(), List.of(String.valueOf(e.getMessage())));
                feeds.saveService(new FeedService(tenantCode, feedKey, code, write(desired), "",
                        before.mandateId(), before.tripId(), true, ERROR, write(failed), now()));
                return null;
            });
        } catch (RuntimeException ignored) {
            // the original failure is what the caller must see
        }
    }

    // ---------------------------------------------------------------- reading and deciding

    private Plan plan(String tenantCode, String actor, FeedProfile profile, String code, FeedServiceRequest d) {
        Plan plan = new Plan(code);
        OffsetDateTime now = now();
        Optional<Mandate> mandate = mandates.list(tenantCode, null, code, 0, 1).stream()
                .filter(m -> m.externalCode().equals(code)).findFirst();
        TripView trip = mandate.flatMap(m -> currentTrip(tenantCode, m))
                .map(ref -> trips.detail(tenantCode, UUID.fromString(ref.tripId()))).orElse(null);
        plan.mandateId = mandate.map(Mandate::id).orElse(null);
        plan.tripId = trip == null ? null : trip.id();

        FeedServiceRequest.Resources r = d.resourcesOrEmpty();
        Resource truck = resolve(tenantCode, TRUCK, r.truck());
        Resource trailer = resolve(tenantCode, TRAILER, r.trailer());
        List<Resource> drivers = r.drivers() == null ? List.of() : r.drivers().stream()
                .filter(k -> k != null && !k.isBlank()).map(k -> resolve(tenantCode, DRIVER, k)).toList();
        Resource mainDriver = drivers.isEmpty() ? null : drivers.get(0);

        boolean departed = d.plannedStart() != null && !d.plannedStart().isAfter(now);
        boolean closeDue = d.plannedEnd() != null
                && !d.plannedEnd().plusMinutes(profile.closeToleranceMinutes()).isAfter(now);

        if (trip != null && (Trip.DONE.equals(trip.status()) || Trip.CANCELLED.equals(trip.status()))) {
            return plan.decided(SKIP, false);
        }
        if (trip == null && mandate.isPresent()
                && (Mandate.CLOSED.equals(mandate.get().status()) || Mandate.CANCELLED.equals(mandate.get().status()))) {
            return plan.decided(SKIP, false);
        }
        if (trip == null && closeDue) {
            // a trip is not created only to be closed at once
            return plan.decided(SKIP, false);
        }
        Map<String, Resource> required = new LinkedHashMap<>();
        required.put(TRUCK, truck);
        required.put(TRAILER, trailer);
        required.put(DRIVER, mainDriver);
        if (trip == null) {
            List<String> missing = new ArrayList<>();
            if (d.plannedStart() == null || d.plannedEnd() == null) {
                missing.add("plannedStart and plannedEnd are required");
            }
            for (String type : profile.requiredResources()) {
                Resource res = required.get(type);
                missing.add(res == null ? type + " is required" : res.problem());
            }
            missing.removeIf(Objects::isNull);
            if (!missing.isEmpty()) {
                plan.errors.addAll(missing);
                return plan.decided(REPORT, !closeDue);
            }
            warnAbout(plan, profile.requiredResources().contains(TRAILER) ? List.of() : Arrays.asList(trailer));
            warnAbout(plan, drivers.size() > 1 ? drivers.subList(1, drivers.size()) : List.of());
            planCreate(plan, tenantCode, actor, profile, code, d, mandate.orElse(null), truck, trailer, drivers,
                    departed);
            return plan.decided(CREATE, true);
        }
        if (closeDue) {
            planClose(plan, tenantCode, actor, profile, trip, mandate.orElseThrow());
            return plan.decided(CLOSE, false);
        }
        List<Resource> named = new ArrayList<>(drivers);
        named.add(0, trailer);
        named.add(0, truck);
        warnAbout(plan, named);
        planChanges(plan, tenantCode, actor, profile, d, mandate.orElseThrow(), trip, truck, trailer, drivers,
                departed);
        return plan.decided(UPDATE, true);
    }

    private Optional<TripRef> currentTrip(String tenantCode, Mandate m) {
        List<TripRef> refs = mandates.tripsOf(tenantCode, UUID.fromString(m.id()));
        return refs.stream().filter(t -> !Trip.CANCELLED.equals(t.status())).findFirst()
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

    private static void warnAbout(Plan plan, List<Resource> resources) {
        resources.stream().filter(Objects::nonNull).map(Resource::problem).filter(Objects::nonNull)
                .forEach(plan.warnings::add);
    }

    // ---------------------------------------------------------------- the steps

    private void planCreate(Plan plan, String tenantCode, String actor, FeedProfile profile, String code,
            FeedServiceRequest d, Mandate mandate, Resource truck, Resource trailer, List<Resource> drivers,
            boolean departed) {
        if (mandate == null) {
            plan.step("create mandate " + code, () -> plan.mandateId = mandates.createOrGet(tenantCode, actor,
                    new MandateRequest(code, d.orderType(), d.orderRef(), null, null, null)).mandate().id());
        }
        List<FeedProfile.StagePlan> planned = profile.stages();
        plan.step("create trip with stages " + planned.stream().map(FeedProfile.StagePlan::stageType).toList(), () -> {
            List<StageRequest> stageRequests = planned.stream().map(s -> new StageRequest(s.stageType(),
                    s.serviceStatus(), null, null, s.stageType().equals(profile.closeStage()) ? d.plannedEnd() : null,
                    null)).toList();
            TripView created = trips.create(tenantCode, actor, new TripRequest(null, null, d.plannedStart(),
                    List.of(plan.mandateId), stageRequests));
            plan.tripId = created.id();
            created.stages().forEach(s -> plan.stageIds.put(s.stageType(), UUID.fromString(s.id())));
        });
        for (Resource res : assignable(truck, trailer, drivers)) {
            plan.step("assign " + res.type() + " " + res.key(), () -> assignments.create(tenantCode, actor,
                    UUID.fromString(plan.tripId), new AssignmentRequest(res.type(), res.id().toString(), null, null)));
        }
        String first = planned.get(0).stageType();
        plan.step("start " + first, () -> stages.start(tenantCode, actor, plan.stageIds.get(first)));
        if (departed && !first.equals(profile.departureStage())) {
            plan.step("close " + first + " (departure time passed)",
                    () -> stages.close(tenantCode, actor, plan.stageIds.get(first)));
            plan.step("start " + profile.departureStage(),
                    () -> stages.start(tenantCode, actor, plan.stageIds.get(profile.departureStage())));
        }
    }

    private void planChanges(Plan plan, String tenantCode, String actor, FeedProfile profile, FeedServiceRequest d,
            Mandate mandate, TripView trip, Resource truck, Resource trailer, List<Resource> drivers,
            boolean departed) {
        UUID tripId = UUID.fromString(trip.id());
        if (d.plannedStart() != null && differs(trip.plannedStart(), d.plannedStart())) {
            plan.step("change planned start", () -> trips.update(tenantCode, actor, tripId,
                    new TripRequest(null, null, d.plannedStart(), null, null)));
        }
        StageView closing = stage(trip, profile.closeStage());
        if (d.plannedEnd() != null && closing != null && Stage.PENDING.equals(closing.status())
                && differs(closing.plannedEnd(), d.plannedEnd())) {
            plan.step("change planned end", () -> stages.update(tenantCode, actor, UUID.fromString(closing.id()),
                    new StageRequest(null, null, null, null, d.plannedEnd(), null)));
        }
        if (d.orderRef() != null && !d.orderRef().equals(mandate.orderRef())) {
            plan.step("change order reference", () -> mandates.update(tenantCode, actor,
                    UUID.fromString(mandate.id()), new MandateRequest(null, null, d.orderRef(), null, null, null)));
        }
        planAssignments(plan, tenantCode, actor, trip, truck, trailer, drivers);
        StageView departure = stage(trip, profile.departureStage());
        if (departed && departure != null && Stage.PENDING.equals(departure.status())) {
            for (StageView s : trip.stages()) {
                if (Stage.RUNNING.equals(s.status())) {
                    plan.step("close " + s.stageType() + " (departure time passed)",
                            () -> stages.close(tenantCode, actor, UUID.fromString(s.id())));
                }
            }
            plan.step("start " + departure.stageType(),
                    () -> stages.start(tenantCode, actor, UUID.fromString(departure.id())));
        }
    }

    /** Ends the windows of resources the feed no longer names and opens windows for the new ones. */
    private void planAssignments(Plan plan, String tenantCode, String actor, TripView trip, Resource truck,
            Resource trailer, List<Resource> drivers) {
        UUID tripId = UUID.fromString(trip.id());
        List<AssignmentView> open = trip.assignments().stream().filter(a -> a.validTo() == null).toList();
        for (Resource res : new Resource[] {truck, trailer}) {
            if (res == null || !res.usable()) {
                continue;
            }
            Optional<AssignmentView> current = open.stream().filter(a -> a.resourceType().equals(res.type()))
                    .findFirst();
            if (current.isPresent() && current.get().resourceId().equals(res.id().toString())) {
                continue;
            }
            current.ifPresent(a -> plan.step("end " + res.type() + " window", () -> assignments.end(tenantCode,
                    actor, UUID.fromString(a.id()), null, "changed by the feed")));
            plan.step("assign " + res.type() + " " + res.key(), () -> assignments.create(tenantCode, actor, tripId,
                    new AssignmentRequest(res.type(), res.id().toString(), null, null)));
        }
        List<String> wanted = drivers.stream().filter(Resource::usable).map(res -> res.id().toString()).toList();
        if (wanted.isEmpty()) {
            return;
        }
        List<AssignmentView> openDrivers = open.stream().filter(a -> DRIVER.equals(a.resourceType())).toList();
        for (AssignmentView a : openDrivers) {
            if (!wanted.contains(a.resourceId())) {
                plan.step("end driver window", () -> assignments.end(tenantCode, actor, UUID.fromString(a.id()),
                        null, "driver no longer in the feed"));
            }
        }
        for (Resource res : drivers) {
            if (res.usable() && openDrivers.stream().noneMatch(a -> a.resourceId().equals(res.id().toString()))) {
                plan.step("assign driver " + res.key(), () -> assignments.create(tenantCode, actor, tripId,
                        new AssignmentRequest(DRIVER, res.id().toString(), null, null)));
            }
        }
    }

    private void planClose(Plan plan, String tenantCode, String actor, FeedProfile profile, TripView trip,
            Mandate mandate) {
        for (StageView s : trip.stages()) {
            if (Stage.RUNNING.equals(s.status()) && !s.stageType().equals(profile.closeStage())) {
                plan.step("close " + s.stageType(), () -> stages.close(tenantCode, actor, UUID.fromString(s.id())));
            }
        }
        StageView closing = stage(trip, profile.closeStage());
        if (closing != null && Stage.PENDING.equals(closing.status())) {
            plan.step("start " + closing.stageType(),
                    () -> stages.start(tenantCode, actor, UUID.fromString(closing.id())));
        }
        if (closing != null && !Stage.CLOSED.equals(closing.status())) {
            plan.step("close " + closing.stageType() + " (realizes the trip)",
                    () -> stages.close(tenantCode, actor, UUID.fromString(closing.id())));
        }
        if (!Mandate.CLOSED.equals(mandate.status()) && !Mandate.CANCELLED.equals(mandate.status())) {
            plan.step("close mandate", () -> mandates.close(tenantCode, actor, UUID.fromString(mandate.id())));
        }
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

    /** The decision for one service and its steps, which run in order inside the service's transaction. */
    private static final class Plan {
        private final String code;
        private final List<String> notes = new ArrayList<>();
        private final List<Runnable> steps = new ArrayList<>();
        private final List<String> warnings = new ArrayList<>();
        private final List<String> errors = new ArrayList<>();
        private final Map<String, UUID> stageIds = new LinkedHashMap<>();
        private String action;
        private boolean open;
        private String mandateId;
        private String tripId;

        private Plan(String code) {
            this.code = code;
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

        void run() {
            steps.forEach(Runnable::run);
        }

        FeedResult result(boolean dryRun) {
            return new FeedResult(code, action, dryRun, mandateId, tripId, List.copyOf(notes), List.copyOf(warnings),
                    List.copyOf(errors));
        }
    }
}
