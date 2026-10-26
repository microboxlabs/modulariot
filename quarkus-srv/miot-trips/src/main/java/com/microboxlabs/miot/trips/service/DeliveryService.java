package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.core.content.Content;
import com.microboxlabs.miot.core.content.ContentService;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.trips.domain.Delivery;
import com.microboxlabs.miot.trips.domain.DeliveryCycle;
import com.microboxlabs.miot.trips.domain.MandateRef;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.domain.TripDocument;
import com.microboxlabs.miot.trips.domain.TripMilestone;
import com.microboxlabs.miot.trips.dto.DeliveryViews;
import com.microboxlabs.miot.trips.store.DeliveryStore;
import com.microboxlabs.miot.trips.store.MonitorRunStore;
import com.microboxlabs.miot.trips.store.MonitorStore;
import com.microboxlabs.miot.trips.store.TripStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.InputStream;
import java.net.URI;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * The deliveries of a trip's loads. A delivery covers mandates of the trip that go to one customer; without a list it
 * takes every mandate no other delivery covers. Its steps follow the cycle of the trip's monitor
 * ({@link DeliveryCycle}): each step needs the one before it, and the first one a proof unless the monitor says
 * otherwise. A proof leaves the first step pending, or confirms it when the monitor says so. Each change is audited on
 * the trip; a confirmed step reaches the monitor as the command {@code delivery_<step>_confirmed}.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class DeliveryService implements DeliveryReach {

    public static final String CREATED = "delivery.created";
    public static final String PROOF_ADDED = "delivery.proof_added";
    public static final String STEP_REQUESTED = "delivery.step_requested";
    public static final String STEP_CONFIRMED = "delivery.step_confirmed";
    public static final String STEP_REJECTED = "delivery.step_rejected";
    private static final String REFERENCE = "reference";
    private static final String CHANNEL = "channel";
    private static final String TRIP = "trip";
    private static final String DELIVERY = "delivery";
    private static final String STEP = "step";
    static final String DOCUMENT = "document";
    private static final int MAX_DELIVERIES = 200;

    private final DeliveryStore store;
    private final TripStore trips;
    private final MonitorRunStore runs;
    private final MonitorStore monitors;
    private final ContentService contents;
    private final AuditService audit;
    private final Transactions tx;
    private final Clock clock;

    @Inject
    public DeliveryService(DeliveryStore store, TripStore trips, MonitorRunStore runs, MonitorStore monitors,
            ContentService contents, AuditService audit, Transactions tx) {
        this(store, trips, runs, monitors, contents, audit, tx, Clock.systemUTC());
    }

    @SuppressWarnings("java:S107") // The CDI constructor plus the clock, for tests.
    public DeliveryService(DeliveryStore store, TripStore trips, MonitorRunStore runs, MonitorStore monitors,
            ContentService contents, AuditService audit, Transactions tx, Clock clock) {
        this.store = store;
        this.trips = trips;
        this.runs = runs;
        this.monitors = monitors;
        this.contents = contents;
        this.audit = audit;
        this.tx = tx;
        this.clock = clock;
    }

    /** What a new delivery says. {@code mandates} are ids or external codes of the trip's mandates. */
    public record NewDelivery(String reference, String customer, List<String> mandates, Map<String, Object> evidence,
            String note, String source) {
    }

    /** A proof kept elsewhere, or one already in the content store ({@code contentId}). */
    public record NewProof(String kind, String contentId, String url, String name, Map<String, Object> metadata,
            String source) {
    }

    /** The trip's cycle, deliveries and the mandates no delivery covers yet. */
    public DeliveryViews.Deliveries list(String tenantCode, UUID tripId) {
        trip(tenantCode, tripId);
        return views(tenantCode, tripId);
    }

    /** The trip's monitor decides the cycle; a trip without a monitor follows {@link DeliveryCycle#DEFAULT}. */
    public DeliveryCycle cycle(String tenantCode, UUID tripId) {
        return runs.state(tenantCode, tripId)
                .flatMap(s -> monitors.version(tenantCode, s.monitorKey(), s.monitorVersion()))
                .map(m -> DeliveryCycle.of(m.params()))
                .orElse(DeliveryCycle.DEFAULT);
    }

    /** A delivery with a reference the trip already has is returned as it is. */
    public DeliveryViews.Delivery create(String tenantCode, String actor, UUID tripId, NewDelivery body) {
        NewDelivery b = body == null ? new NewDelivery(null, null, null, null, null, null) : body;
        String reference = Check.limitedOrNull(Check.blankToNull(b.reference()), REFERENCE, 128);
        String customer = Check.limitedOrNull(Check.blankToNull(b.customer()), "customer", 255);
        String note = Check.limitedOrNull(b.note(), "note", 1000);
        String source = source(b.source());
        Map<String, Object> evidence = MilestoneService.evidence(b.evidence());
        String id = tx.inTransaction(() -> {
            Trip trip = trip(tenantCode, tripId);
            if (Trip.CANCELLED.equals(trip.status())) {
                throw new IllegalStateException("the trip is cancelled");
            }
            if (reference != null) {
                Optional<Delivery> existing = store.findByReference(tenantCode, tripId, reference);
                if (existing.isPresent()) {
                    return existing.get().id();
                }
            }
            List<Delivery> current = store.list(tenantCode, tripId);
            if (current.size() >= MAX_DELIVERIES) {
                throw new IllegalStateException("a trip holds at most " + MAX_DELIVERIES + " deliveries");
            }
            List<String> mandates = mandates(tenantCode, tripId, b.mandates(), current);
            Delivery saved = store.insert(new Delivery(UUID.randomUUID().toString(), tenantCode, tripId.toString(),
                    reference, customer, source, evidence, note, mandates, null, actor, null, actor));
            Map<String, Object> d = new LinkedHashMap<>();
            d.put(DELIVERY, saved.id());
            putIf(d, REFERENCE, reference);
            d.put("mandates", mandates.size());
            audit.log(tenantCode, actor, CREATED, TRIP, tripId.toString(), tripId.toString(), d);
            return saved.id();
        });
        return view(tenantCode, tripId, id);
    }

    /** Stores the file and adds it as a proof; a failed save leaves the file to the content cleanup. */
    @SuppressWarnings("java:S107") // A proof upload carries the file and its description.
    public DeliveryViews.Delivery upload(String tenantCode, String actor, UUID tripId, UUID deliveryId, String kind,
            String name, String mimetype, InputStream file, Map<String, Object> metadata, String source) {
        delivery(tenantCode, tripId, deliveryId);
        Content c = contents.write(tenantCode, actor, name, mimetype, file);
        return addProof(tenantCode, actor, tripId, deliveryId,
                new NewProof(kind, c.id(), null, c.name(), metadata, source));
    }

    public DeliveryViews.Delivery addProof(String tenantCode, String actor, UUID tripId, UUID deliveryId,
            NewProof body) {
        if (body == null) {
            throw new IllegalArgumentException("a proof is required");
        }
        String kind = Check.oneOf(body.kind() == null ? "other" : body.kind(), "kind",
                Delivery.Proof.KINDS.toArray(String[]::new));
        String url = url(body.url());
        UUID contentId = body.contentId() == null ? null : uuid(body.contentId(), "contentId");
        if ((contentId == null) == (url == null)) {
            throw new IllegalArgumentException("a proof has either a file (contentId) or a url");
        }
        String source = source(body.source());
        Map<String, Object> metadata = MilestoneService.evidence(body.metadata());
        String id = tx.inTransaction(() -> {
            Delivery d = delivery(tenantCode, tripId, deliveryId);
            String mimetype = null;
            String name = Check.limitedOrNull(Check.blankToNull(body.name()), "name", 255);
            if (contentId != null) {
                Content c = unownedContent(tenantCode, contentId);
                mimetype = c.mimetype();
                name = name == null ? c.name() : name;
            }
            Delivery.Proof proof = store.insert(new Delivery.Proof(UUID.randomUUID().toString(), d.id(), tenantCode,
                    kind, contentId == null ? null : contentId.toString(), url, name, mimetype, metadata, source,
                    null, actor));
            if (contentId != null) {
                contents.owner(tenantCode, contentId, "trips:delivery_proof:" + proof.id());
            }
            Map<String, Object> details = new LinkedHashMap<>();
            details.put(DELIVERY, d.id());
            details.put("proof", proof.id());
            details.put("kind", kind);
            audit.log(tenantCode, actor, PROOF_ADDED, TRIP, tripId.toString(), tripId.toString(), details);
            onProof(tenantCode, actor, tripId, d, source);
            return d.id();
        });
        return view(tenantCode, tripId, id);
    }

    private Content unownedContent(String tenantCode, UUID id) {
        Content content = contents.find(tenantCode, id)
                .orElseThrow(() -> new IllegalArgumentException("content not found"));
        if (content.owner() != null) {
            throw new IllegalStateException("the content already belongs to another record");
        }
        return content;
    }

    /**
     * Records a trip document as a proof of the delivery. The document keeps its content; the proof names it in its
     * metadata ({@value #DOCUMENT}). Runs inside the caller's transaction.
     */
    public void linkDocument(String tenantCode, String actor, UUID tripId, UUID deliveryId, TripDocument document) {
        Delivery d = delivery(tenantCode, tripId, deliveryId);
        String kind = document.mimetype() != null && document.mimetype().startsWith("image/") ? "photo" : DOCUMENT;
        Delivery.Proof proof = store.insert(new Delivery.Proof(UUID.randomUUID().toString(), d.id(), tenantCode,
                kind, document.contentId(), null, document.name(), document.mimetype(), Map.of(DOCUMENT, document.id()),
                "ui", null, actor));
        Map<String, Object> details = new LinkedHashMap<>();
        details.put(DELIVERY, d.id());
        details.put("proof", proof.id());
        details.put("kind", kind);
        details.put(DOCUMENT, document.id());
        audit.log(tenantCode, actor, PROOF_ADDED, TRIP, tripId.toString(), tripId.toString(), details);
        onProof(tenantCode, actor, tripId, d, "ui");
    }

    /**
     * Drops the proofs a trip document recorded. Refused when the document proves a delivery with a confirmed step.
     * Runs inside the caller's transaction.
     */
    public void unlinkDocument(String tenantCode, UUID tripId, String documentId) {
        List<Delivery.Proof> linked = store.proofs(tenantCode, tripId).stream()
                .filter(p -> documentId.equals(p.metadata().get(DOCUMENT))).toList();
        Set<String> confirmed = new HashSet<>();
        store.steps(tenantCode, tripId).stream().filter(Delivery.Step::isConfirmed)
                .forEach(s -> confirmed.add(s.deliveryId()));
        if (linked.stream().anyMatch(p -> confirmed.contains(p.deliveryId()))) {
            throw new IllegalStateException("the document proves a delivery with a confirmed step");
        }
        linked.forEach(p -> store.deleteProof(tenantCode, UUID.fromString(p.id())));
    }

    /**
     * Confirms the step at {@code at} (default: the time a pending request proposed, else now). The step before it
     * must be confirmed, and the first one needs a proof when the cycle asks for one. Confirming a confirmed step
     * adds its evidence and changes nothing else.
     */
    @SuppressWarnings("java:S107") // Mirrors the milestone confirmation.
    public DeliveryViews.Delivery confirm(String tenantCode, String actor, UUID tripId, UUID deliveryId, String step,
            OffsetDateTime at, String channel, String note, Map<String, Object> evidence) {
        String ch = Check.oneOf(channel == null ? "api" : channel, CHANNEL,
                TripMilestone.CHANNELS.toArray(String[]::new));
        String n = Check.limitedOrNull(note, "note", 1000);
        Map<String, Object> e = MilestoneService.evidence(evidence);
        String id = tx.inTransaction(() -> {
            Delivery d = delivery(tenantCode, tripId, deliveryId);
            DeliveryCycle cycle = cycle(tenantCode, tripId);
            String s = step(cycle, step);
            confirmStep(tenantCode, actor, tripId, d, cycle, s, new Confirmation(at, ch, n, e));
            return d.id();
        });
        return view(tenantCode, tripId, id);
    }

    /** Marks a pending step as not done; a new proof or request asks again. */
    public DeliveryViews.Delivery reject(String tenantCode, String actor, UUID tripId, UUID deliveryId, String step,
            String channel, String note) {
        String ch = Check.oneOf(channel == null ? "api" : channel, CHANNEL,
                TripMilestone.CHANNELS.toArray(String[]::new));
        String n = Check.limitedOrNull(note, "note", 1000);
        String id = tx.inTransaction(() -> {
            Delivery d = delivery(tenantCode, tripId, deliveryId);
            String s = step(cycle(tenantCode, tripId), step);
            Delivery.Step current = store.step(tenantCode, UUID.fromString(d.id()), s)
                    .orElse(Delivery.Step.unrecorded(tenantCode, d.id(), s));
            if (!current.isPending()) {
                throw new IllegalStateException("the " + s + " step has no pending request to reject");
            }
            store.save(new Delivery.Step(d.id(), s, tenantCode, TripMilestone.REJECTED, current.source(),
                    current.proposedAt(), current.evidence(), null, actor, ch, n, null, actor));
            audit.log(tenantCode, actor, STEP_REJECTED, TRIP, tripId.toString(), tripId.toString(),
                    details(d, s, now(), ch));
            return d.id();
        });
        return view(tenantCode, tripId, id);
    }

    /** A proof's file, when the proof is in the content store. */
    public ContentService.Opened proofContent(String tenantCode, UUID tripId, UUID proofId) {
        trip(tenantCode, tripId);
        Delivery.Proof proof = store.proofs(tenantCode, tripId).stream()
                .filter(p -> p.id().equals(proofId.toString())).findFirst()
                .orElseThrow(() -> new NoSuchElementException("proof not found"));
        if (proof.contentId() == null) {
            throw new NoSuchElementException("the proof is a link, not a stored file");
        }
        return contents.open(tenantCode, UUID.fromString(proof.contentId()));
    }

    /**
     * Whether every load of the trip reached {@code step}: each mandate is in a delivery with the step confirmed. A
     * trip without mandates needs at least one delivery, and all of them with the step confirmed.
     */
    @Override
    public boolean reached(String tenantCode, UUID tripId, String step) {
        return reached(store.list(tenantCode, tripId), store.steps(tenantCode, tripId),
                trips.mandatesOf(tenantCode, tripId), step);
    }

    @Override
    public Map<String, Boolean> snapshot(String tenantCode, UUID tripId) {
        List<Delivery> current = store.list(tenantCode, tripId);
        List<Delivery.Step> steps = store.steps(tenantCode, tripId);
        List<MandateRef> mandates = trips.mandatesOf(tenantCode, tripId);
        Map<String, Boolean> result = new LinkedHashMap<>();
        DeliveryCycle.ALL_STEPS.forEach(step -> result.put(step, reached(current, steps, mandates, step)));
        return Map.copyOf(result);
    }

    private static boolean reached(List<Delivery> deliveries, List<Delivery.Step> steps,
            List<MandateRef> mandates, String step) {
        Set<String> confirmed = new HashSet<>();
        steps.stream().filter(s -> s.step().equals(step) && s.isConfirmed())
                .forEach(s -> confirmed.add(s.deliveryId()));
        if (mandates.isEmpty()) {
            return !deliveries.isEmpty() && deliveries.stream().allMatch(d -> confirmed.contains(d.id()));
        }
        Set<String> done = new HashSet<>();
        deliveries.stream().filter(d -> confirmed.contains(d.id())).forEach(d -> done.addAll(d.mandateIds()));
        return mandates.stream().allMatch(m -> done.contains(m.mandateId()));
    }

    private record Confirmation(OffsetDateTime at, String channel, String note, Map<String, Object> evidence) {
    }

    private void confirmStep(String tenantCode, String actor, UUID tripId, Delivery d, DeliveryCycle cycle, String s,
            Confirmation confirmation) {
        OffsetDateTime at = confirmation.at();
        String ch = confirmation.channel();
        String n = confirmation.note();
        Map<String, Object> e = confirmation.evidence();
        UUID id = UUID.fromString(d.id());
        Delivery.Step current = store.step(tenantCode, id, s).orElse(Delivery.Step.unrecorded(tenantCode, d.id(), s));
        if (current.isConfirmed()) {
            if (!e.isEmpty()) {
                store.save(new Delivery.Step(d.id(), s, tenantCode, current.status(), current.source(),
                        current.proposedAt(), merge(current.evidence(), e), current.confirmedAt(),
                        current.confirmedBy(), current.channel(), current.note(), null, actor));
            }
            return;
        }
        String before = cycle.before(s);
        if (before != null && store.step(tenantCode, id, before).filter(Delivery.Step::isConfirmed).isEmpty()) {
            throw new IllegalStateException("the " + before + " step is not confirmed");
        }
        if (s.equals(cycle.first()) && cycle.proofRequired()
                && store.proofs(tenantCode, tripId).stream().noneMatch(p -> p.deliveryId().equals(d.id()))) {
            throw new IllegalStateException("the delivery has no proof");
        }
        OffsetDateTime proposed = current.isPending() ? current.proposedAt() : null;
        OffsetDateTime when = at == null ? proposed : at;
        when = utc(when == null ? now() : when);
        store.save(new Delivery.Step(d.id(), s, tenantCode, TripMilestone.CONFIRMED, current.source(),
                current.proposedAt(), merge(current.evidence(), e), when, actor, ch, n, null, actor));
        audit.log(tenantCode, actor, STEP_CONFIRMED, TRIP, tripId.toString(), tripId.toString(),
                details(d, s, when, ch));
    }

    /** A proof asks for the first step, or confirms it when the cycle says so. */
    private void onProof(String tenantCode, String actor, UUID tripId, Delivery d, String source) {
        DeliveryCycle cycle = cycle(tenantCode, tripId);
        String first = cycle.first();
        Delivery.Step current = store.step(tenantCode, UUID.fromString(d.id()), first)
                .orElse(Delivery.Step.unrecorded(tenantCode, d.id(), first));
        if (current.isConfirmed()) {
            return;
        }
        if (cycle.confirmOnProof()) {
            confirmStep(tenantCode, actor, tripId, d, cycle, first, new Confirmation(null, "api", null, Map.of()));
            return;
        }
        if (current.isPending()) {
            return;
        }
        OffsetDateTime at = now();
        store.save(new Delivery.Step(d.id(), first, tenantCode, TripMilestone.PENDING, source, at,
                current.evidence(), null, null, null, null, null, actor));
        audit.log(tenantCode, actor, STEP_REQUESTED, TRIP, tripId.toString(), tripId.toString(),
                details(d, first, at, null));
    }

    private DeliveryViews.Deliveries views(String tenantCode, UUID tripId) {
        DeliveryCycle cycle = cycle(tenantCode, tripId);
        List<MandateRef> mandates = trips.mandatesOf(tenantCode, tripId);
        Map<String, String> codes = new LinkedHashMap<>();
        mandates.forEach(m -> codes.put(m.mandateId(), m.externalCode()));
        List<Delivery> deliveries = store.list(tenantCode, tripId);
        List<Delivery.Step> steps = store.steps(tenantCode, tripId);
        List<Delivery.Proof> proofs = store.proofs(tenantCode, tripId);
        Set<String> covered = new HashSet<>();
        List<DeliveryViews.Delivery> out = new ArrayList<>();
        for (Delivery d : deliveries) {
            covered.addAll(d.mandateIds());
            out.add(DeliveryViews.Delivery.of(d, cycle, codes, steps, proofs));
        }
        List<DeliveryViews.Mandate> uncovered = mandates.stream().filter(m -> !covered.contains(m.mandateId()))
                .map(m -> new DeliveryViews.Mandate(m.mandateId(), m.externalCode())).toList();
        return new DeliveryViews.Deliveries(cycle, out, uncovered);
    }

    private DeliveryViews.Delivery view(String tenantCode, UUID tripId, String deliveryId) {
        return views(tenantCode, tripId).deliveries().stream().filter(d -> d.id().equals(deliveryId)).findFirst()
                .orElseThrow();
    }

    /** The mandates the delivery covers: those named, or every one no delivery covers. */
    private List<String> mandates(String tenantCode, UUID tripId, List<String> named, List<Delivery> current) {
        List<MandateRef> linked = trips.mandatesOf(tenantCode, tripId);
        Set<String> covered = new HashSet<>();
        current.forEach(d -> covered.addAll(d.mandateIds()));
        if (named == null || named.isEmpty()) {
            List<String> free = linked.stream().map(MandateRef::mandateId).filter(id -> !covered.contains(id))
                    .toList();
            if (!linked.isEmpty() && free.isEmpty()) {
                throw new IllegalStateException("every load of the trip already has a delivery");
            }
            return free;
        }
        List<String> out = new ArrayList<>();
        for (String n : named) {
            MandateRef ref = linked.stream().filter(m -> m.mandateId().equals(n) || m.externalCode().equals(n))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("mandate " + n + " is not on the trip"));
            if (covered.contains(ref.mandateId())) {
                throw new IllegalStateException("mandate " + ref.externalCode() + " already has a delivery");
            }
            if (!out.contains(ref.mandateId())) {
                out.add(ref.mandateId());
            }
        }
        return out;
    }

    private Trip trip(String tenantCode, UUID tripId) {
        return trips.find(tenantCode, tripId).orElseThrow(() -> new NoSuchElementException("trip not found"));
    }

    private Delivery delivery(String tenantCode, UUID tripId, UUID deliveryId) {
        trip(tenantCode, tripId);
        return store.find(tenantCode, tripId, deliveryId)
                .orElseThrow(() -> new NoSuchElementException("delivery not found"));
    }

    private static String step(DeliveryCycle cycle, String step) {
        if (step == null || !cycle.steps().contains(step)) {
            throw new IllegalArgumentException("step must be one of " + String.join(", ", cycle.steps()));
        }
        return step;
    }

    private static String source(String source) {
        return source == null || source.isBlank() ? "api" : Check.limited(source.trim(), "source", 32);
    }

    /** Only http and https links. */
    private static String url(String url) {
        String u = Check.blankToNull(url);
        if (u == null) {
            return null;
        }
        Check.limited(u, "url", 2048);
        try {
            String scheme = URI.create(u).getScheme();
            if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) {
                throw new IllegalArgumentException("url must be an http or https link");
            }
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("url must be an http or https link");
        }
        return u;
    }

    private static UUID uuid(String id, String field) {
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(field + " is not an id");
        }
    }

    private static Map<String, Object> details(Delivery d, String step, OffsetDateTime at, String channel) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put(DELIVERY, d.id());
        out.put(STEP, step);
        out.put("at", at.toString());
        putIf(out, CHANNEL, channel);
        putIf(out, REFERENCE, d.reference());
        return out;
    }

    private static Map<String, Object> merge(Map<String, Object> current, Map<String, Object> added) {
        if (added.isEmpty()) {
            return current;
        }
        Map<String, Object> out = new LinkedHashMap<>(current);
        out.putAll(added);
        return MilestoneService.evidence(out);
    }

    private static void putIf(Map<String, Object> m, String key, Object value) {
        if (value != null) {
            m.put(key, value);
        }
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC).truncatedTo(ChronoUnit.MICROS);
    }

    private static OffsetDateTime utc(OffsetDateTime t) {
        return t.withOffsetSameInstant(ZoneOffset.UTC).truncatedTo(ChronoUnit.MICROS);
    }
}
