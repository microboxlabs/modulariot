package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.core.content.Content;
import com.microboxlabs.miot.core.content.ContentService;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.core.selectable.SelectableOption;
import com.microboxlabs.miot.trips.domain.TripDocument;
import com.microboxlabs.miot.trips.store.TripDocumentStore;
import com.microboxlabs.miot.trips.store.TripStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.InputStream;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;

/**
 * A trip's documents (multimedia): images and PDFs with a document type from {@link TripDocumentLists}. Replacing the
 * file adds a version and keeps the earlier one. A document whose type needs review starts pending; each review
 * round records a verdict with reasons and a comment against the current version. A document may prove a delivery.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class TripDocumentService {

    public static final String ADDED = "document.added";
    public static final String REPLACED = "document.replaced";
    public static final String CHANGED = "document.changed";
    public static final String DELETED = "document.deleted";
    public static final String REVIEWED = "document.reviewed";

    private static final String TRIP = "trip";
    private static final int MAX_REASONS = 20;

    private final TripDocumentStore store;
    private final TripStore trips;
    private final ContentService contents;
    private final TripDocumentLists lists;
    private final DeliveryService deliveries;
    private final AuditService audit;
    private final Transactions tx;
    private final Clock clock;

    @Inject
    public TripDocumentService(TripDocumentStore store, TripStore trips, ContentService contents,
            TripDocumentLists lists, DeliveryService deliveries, AuditService audit, Transactions tx) {
        this(store, trips, contents, lists, deliveries, audit, tx, Clock.systemUTC());
    }

    @SuppressWarnings("java:S107") // The CDI constructor plus the clock, for tests.
    public TripDocumentService(TripDocumentStore store, TripStore trips, ContentService contents,
            TripDocumentLists lists, DeliveryService deliveries, AuditService audit, Transactions tx, Clock clock) {
        this.store = store;
        this.trips = trips;
        this.contents = contents;
        this.lists = lists;
        this.deliveries = deliveries;
        this.audit = audit;
        this.tx = tx;
        this.clock = clock;
    }

    /** A document type: its label per language and whether its documents need review. */
    public record Type(String value, Map<String, String> label, boolean reviewable, boolean disabled) {
    }

    /** A review reason; {@code appliesTo} is the one type it is offered for, null for every type. */
    public record Reason(String value, Map<String, String> label, String appliesTo, boolean disabled) {
    }

    public record Catalog(List<Type> types, List<Reason> reasons) {
    }

    /** The organization's document types and review reasons. */
    public Catalog catalog(String tenantCode) {
        return new Catalog(
                lists.types(tenantCode).stream().map(o -> new Type(o.value(), o.label(),
                        TripDocumentLists.reviewable(o), o.disabled())).toList(),
                lists.reasons(tenantCode).stream().map(o -> new Reason(o.value(), o.label(), o.parent(),
                        o.disabled())).toList());
    }

    public List<TripDocument> list(String tenantCode, UUID tripId) {
        trip(tenantCode, tripId);
        return store.list(tenantCode, tripId);
    }

    /** Stores the file and adds it to the trip with its type; with {@code deliveryId} it also proves that delivery. */
    @SuppressWarnings("java:S107") // An upload carries the file and its description.
    public TripDocument upload(String tenantCode, String actor, UUID tripId, String docType, UUID deliveryId,
            String name, String mimetype, InputStream file) {
        trip(tenantCode, tripId);
        SelectableOption type = lists.type(tenantCode, required(docType));
        Content c = contents.write(tenantCode, actor, name, mimetype, file);
        return tx.inTransaction(() -> {
            trip(tenantCode, tripId);
            boolean reviewable = TripDocumentLists.reviewable(type);
            String id = UUID.randomUUID().toString();
            TripDocument created = store.insert(new TripDocument(id, tenantCode, tripId.toString(), c.id(),
                    displayName(c.name()), type.value(), 1, reviewable, reviewable ? TripDocument.PENDING : null,
                    null, null, deliveryId == null ? null : deliveryId.toString(), null, 0, null, actor, null,
                    actor));
            contents.owner(tenantCode, UUID.fromString(c.id()), owner(id));
            if (deliveryId != null) {
                deliveries.linkDocument(tenantCode, actor, tripId, deliveryId, id, c.id(), created.name(),
                        created.mimetype());
            }
            log(tenantCode, actor, ADDED, tripId, created, Map.of("type", created.docType()));
            return created;
        });
    }

    /** Replaces the file with a new version; a reviewed document goes back to pending. */
    public TripDocument replace(String tenantCode, String actor, UUID tripId, UUID documentId, String name,
            String mimetype, InputStream file) {
        document(tenantCode, tripId, documentId);
        Content c = contents.write(tenantCode, actor, name, mimetype, file);
        return tx.inTransaction(() -> {
            TripDocument d = document(tenantCode, tripId, documentId);
            int version = d.version() + 1;
            contents.owner(tenantCode, UUID.fromString(d.contentId()), owner(d.id()) + ":v" + d.version());
            TripDocument replaced = store.update(new TripDocument(d.id(), tenantCode, d.tripId(), c.id(), d.name(),
                    d.docType(), version, d.reviewable(), d.reviewable() ? TripDocument.PENDING : null, null, null,
                    d.deliveryId(), null, 0, d.createdAt(), d.createdBy(), null, actor), true);
            contents.owner(tenantCode, UUID.fromString(c.id()), owner(d.id()));
            log(tenantCode, actor, REPLACED, tripId, replaced, Map.of("version", version));
            return replaced;
        });
    }

    /**
     * Renames the document or changes its type. A type that needs no review drops the review status; one that needs
     * it starts pending.
     */
    public TripDocument change(String tenantCode, String actor, UUID tripId, UUID documentId, String docType,
            String name) {
        SelectableOption type = docType == null ? null : lists.type(tenantCode, required(docType));
        String newName = name == null ? null : Check.required(name, "name", 255);
        return tx.inTransaction(() -> {
            TripDocument d = document(tenantCode, tripId, documentId);
            boolean reviewable = type == null ? d.reviewable() : TripDocumentLists.reviewable(type);
            String status = d.reviewStatus();
            OffsetDateTime reviewedAt = d.reviewedAt();
            String reviewedBy = d.reviewedBy();
            if (!reviewable) {
                status = null;
                reviewedAt = null;
                reviewedBy = null;
            } else if (!d.reviewable()) {
                status = TripDocument.PENDING;
            }
            TripDocument changed = store.update(new TripDocument(d.id(), tenantCode, d.tripId(), d.contentId(),
                    newName == null ? d.name() : newName, type == null ? d.docType() : type.value(), d.version(),
                    reviewable, status, reviewedAt, reviewedBy, d.deliveryId(), null, 0, d.createdAt(), d.createdBy(),
                    null, actor), false);
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("type", changed.docType());
            details.put("name", changed.name());
            log(tenantCode, actor, CHANGED, tripId, changed, details);
            return changed;
        });
    }

    /** Deletes the document and releases its files; refused when it proves a delivery with a confirmed step. */
    public void delete(String tenantCode, String actor, UUID tripId, UUID documentId) {
        tx.inTransaction(() -> {
            TripDocument d = document(tenantCode, tripId, documentId);
            deliveries.unlinkDocument(tenantCode, tripId, d.id());
            for (UUID content : store.delete(tenantCode, documentId)) {
                contents.owner(tenantCode, content, null);
            }
            log(tenantCode, actor, DELETED, tripId, d, Map.of("type", d.docType()));
            return null;
        });
    }

    public ContentService.Opened content(String tenantCode, UUID tripId, UUID documentId) {
        TripDocument d = document(tenantCode, tripId, documentId);
        return contents.open(tenantCode, UUID.fromString(d.contentId()));
    }

    public List<TripDocument.Review> reviews(String tenantCode, UUID tripId, UUID documentId) {
        document(tenantCode, tripId, documentId);
        return store.reviews(tenantCode, documentId);
    }

    /**
     * Records a review round on the current version: APPROVED, REJECTED or PENDING (sent back for another look),
     * with its reasons and comment. The document takes the verdict as its status.
     */
    public TripDocument.Review review(String tenantCode, String actor, UUID tripId, UUID documentId, String verdict,
            List<String> reasons, String comment) {
        String v = verdict == null ? "" : verdict.toUpperCase(Locale.ROOT);
        if (!TripDocument.Review.VERDICTS.contains(v)) {
            throw new IllegalArgumentException("verdict must be one of " + TripDocument.Review.VERDICTS);
        }
        List<String> codes = reasons == null ? List.of()
                : reasons.stream().map(r -> Check.required(r, "reason", 64)).distinct().toList();
        if (codes.size() > MAX_REASONS) {
            throw new IllegalArgumentException("at most " + MAX_REASONS + " reasons");
        }
        String note = Check.limitedOrNull(Check.blankToNull(comment), "comment", 4000);
        return tx.inTransaction(() -> {
            TripDocument d = document(tenantCode, tripId, documentId);
            if (!d.reviewable()) {
                throw new IllegalStateException("documents of type " + d.docType() + " need no review");
            }
            TripDocument.Review round = store.insert(new TripDocument.Review(d.id(), 0, d.version(), v, codes, note,
                    actor, null));
            store.update(new TripDocument(d.id(), tenantCode, d.tripId(), d.contentId(), d.name(), d.docType(),
                    d.version(), true, v.toLowerCase(Locale.ROOT), now(), actor, d.deliveryId(), null, 0,
                    d.createdAt(), d.createdBy(), null, actor), false);
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("verdict", v);
            details.put("version", d.version());
            details.put("reasons", codes);
            log(tenantCode, actor, REVIEWED, tripId, d, details);
            return round;
        });
    }

    private void log(String tenantCode, String actor, String action, UUID tripId, TripDocument d,
            Map<String, Object> extra) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("document", d.id());
        details.putAll(extra);
        audit.log(tenantCode, actor, action, TRIP, tripId.toString(), tripId.toString(), details);
    }

    private void trip(String tenantCode, UUID tripId) {
        trips.find(tenantCode, tripId).orElseThrow(() -> new NoSuchElementException("trip not found"));
    }

    private TripDocument document(String tenantCode, UUID tripId, UUID documentId) {
        return store.find(tenantCode, tripId, documentId)
                .orElseThrow(() -> new NoSuchElementException("document not found"));
    }

    private static String required(String docType) {
        return Check.required(docType, "docType", 64);
    }

    private static String displayName(String name) {
        return name == null || name.isBlank() ? "document" : Check.limited(name, "name", 255);
    }

    static String owner(String documentId) {
        return "trips:document:" + documentId;
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
    }
}
