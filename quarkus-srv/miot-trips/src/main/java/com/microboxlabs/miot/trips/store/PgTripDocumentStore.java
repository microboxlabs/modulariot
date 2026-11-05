package com.microboxlabs.miot.trips.store;

import static com.microboxlabs.miot.trips.store.Pg.query;
import static com.microboxlabs.miot.trips.store.Pg.time;

import com.microboxlabs.miot.trips.domain.TripDocument;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link TripDocumentStore} on the modulith database, schema {@code miot_trips}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class PgTripDocumentStore implements TripDocumentStore {

    private static final String SELECT = "SELECT ";
    private static final String COLUMNS = """
            d.id, d.tenant_code, d.trip_id, d.content_id, d.name, d.doc_type, d.version, d.reviewable,
            d.review_status, d.reviewed_at, d.reviewed_by, d.delivery_id, c.mimetype, c.size, d.created_at,
            d.created_by, d.updated_at, d.updated_by""";
    private static final String FROM = """
             FROM miot_trips.trip_document d
             LEFT JOIN miot_core.content c ON c.id = d.content_id AND c.tenant_code = d.tenant_code""";
    private static final String REVIEW_COLUMNS =
            "document_id, seq, version, verdict, reasons, comment, reviewed_by, decided_at";

    private final Supplier<Pool> pool;

    @Inject
    PgTripDocumentStore(Instance<Pool> pool) {
        this(pool::get);
    }

    public PgTripDocumentStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public List<TripDocument> list(String tenantCode, UUID tripId) {
        return query(pool.get(), SELECT + COLUMNS + " " + FROM
                + " WHERE d.tenant_code = $1 AND d.trip_id = $2 ORDER BY d.created_at, d.id",
                Tuple.of(tenantCode, tripId)).stream().map(PgTripDocumentStore::document).toList();
    }

    @Override
    public Optional<TripDocument> find(String tenantCode, UUID tripId, UUID documentId) {
        // FOR UPDATE cannot lock the nullable side of an outer join, so the row is locked first
        query(pool.get(), "SELECT 1 FROM miot_trips.trip_document WHERE tenant_code = $1 AND trip_id = $2 AND id = $3"
                + Pg.lock(), Tuple.of(tenantCode, tripId, documentId));
        return query(pool.get(), SELECT + COLUMNS + " " + FROM
                + " WHERE d.tenant_code = $1 AND d.trip_id = $2 AND d.id = $3",
                Tuple.of(tenantCode, tripId, documentId)).stream().map(PgTripDocumentStore::document).findFirst();
    }

    @Override
    public TripDocument insert(TripDocument d) {
        UUID id = UUID.fromString(d.id());
        query(pool.get(), """
                INSERT INTO miot_trips.trip_document (id, tenant_code, trip_id, content_id, name, doc_type, version,
                    reviewable, review_status, delivery_id, created_by, updated_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)""",
                Tuple.tuple().addUUID(id).addString(d.tenantCode()).addUUID(UUID.fromString(d.tripId()))
                        .addUUID(UUID.fromString(d.contentId())).addString(d.name()).addString(d.docType())
                        .addInteger(d.version()).addBoolean(d.reviewable()).addString(d.reviewStatus())
                        .addUUID(Pg.parse(d.deliveryId())).addString(d.createdBy()));
        version(id, d.version(), d.contentId(), d.createdBy());
        return reread(d.tenantCode(), id);
    }

    @Override
    public TripDocument update(TripDocument d, boolean newVersion) {
        UUID id = UUID.fromString(d.id());
        query(pool.get(), """
                UPDATE miot_trips.trip_document
                   SET content_id = $3, name = $4, doc_type = $5, version = $6, reviewable = $7, review_status = $8,
                       reviewed_at = $9, reviewed_by = $10, updated_at = now(), updated_by = $11
                 WHERE tenant_code = $1 AND id = $2""",
                Tuple.tuple().addString(d.tenantCode()).addUUID(id).addUUID(UUID.fromString(d.contentId()))
                        .addString(d.name()).addString(d.docType()).addInteger(d.version())
                        .addBoolean(d.reviewable()).addString(d.reviewStatus()).addOffsetDateTime(d.reviewedAt())
                        .addString(d.reviewedBy()).addString(d.updatedBy()));
        if (newVersion) {
            version(id, d.version(), d.contentId(), d.updatedBy());
        }
        return reread(d.tenantCode(), id);
    }

    @Override
    public List<UUID> delete(String tenantCode, UUID documentId) {
        List<UUID> contents = query(pool.get(), """
                SELECT v.content_id FROM miot_trips.trip_document_version v
                  JOIN miot_trips.trip_document d ON d.id = v.document_id
                 WHERE d.tenant_code = $1 AND d.id = $2""", Tuple.of(tenantCode, documentId))
                .stream().map(r -> r.getUUID("content_id")).toList();
        query(pool.get(), "DELETE FROM miot_trips.trip_document WHERE tenant_code = $1 AND id = $2",
                Tuple.of(tenantCode, documentId));
        return contents;
    }

    @Override
    public List<TripDocument.Review> reviews(String tenantCode, UUID documentId) {
        return query(pool.get(), SELECT + REVIEW_COLUMNS + " " + """
                 FROM miot_trips.trip_document_review r
                 WHERE r.document_id = $2
                   AND EXISTS (SELECT 1 FROM miot_trips.trip_document d WHERE d.id = r.document_id
                                AND d.tenant_code = $1)
                 ORDER BY r.seq""", Tuple.of(tenantCode, documentId))
                .stream().map(PgTripDocumentStore::review).toList();
    }

    @Override
    public TripDocument.Review insert(TripDocument.Review r) {
        return query(pool.get(), """
                INSERT INTO miot_trips.trip_document_review (document_id, seq, version, verdict, reasons, comment,
                    reviewed_by)
                VALUES ($1, (SELECT coalesce(max(seq), 0) + 1 FROM miot_trips.trip_document_review
                              WHERE document_id = $1), $2, $3, $4, $5, $6)
                RETURNING\s""" + REVIEW_COLUMNS,
                Tuple.tuple().addUUID(UUID.fromString(r.documentId())).addInteger(r.version())
                        .addString(r.verdict()).addArrayOfString(r.reasons().toArray(String[]::new))
                        .addString(r.comment()).addString(r.reviewedBy()))
                .stream().map(PgTripDocumentStore::review).findFirst().orElseThrow();
    }

    private void version(UUID documentId, int version, String contentId, String actor) {
        query(pool.get(), """
                INSERT INTO miot_trips.trip_document_version (document_id, version, content_id, created_by)
                VALUES ($1, $2, $3, $4)""",
                Tuple.of(documentId, version, UUID.fromString(contentId), actor));
    }

    private TripDocument reread(String tenantCode, UUID id) {
        return query(pool.get(), SELECT + COLUMNS + " " + FROM + " WHERE d.tenant_code = $1 AND d.id = $2",
                Tuple.of(tenantCode, id)).stream().map(PgTripDocumentStore::document).findFirst().orElseThrow();
    }

    private static TripDocument document(Row r) {
        Long size = r.getLong("size");
        return new TripDocument(Pg.text(r, "id"), r.getString("tenant_code"), Pg.text(r, "trip_id"),
                Pg.text(r, "content_id"), r.getString("name"), r.getString("doc_type"), r.getInteger("version"),
                Boolean.TRUE.equals(r.getBoolean("reviewable")), r.getString("review_status"),
                time(r, "reviewed_at"), r.getString("reviewed_by"), Pg.text(r, "delivery_id"),
                r.getString("mimetype"), size == null ? 0 : size, time(r, "created_at"), r.getString("created_by"),
                time(r, "updated_at"), r.getString("updated_by"));
    }

    private static TripDocument.Review review(Row r) {
        String[] reasons = r.getArrayOfStrings("reasons");
        return new TripDocument.Review(Pg.text(r, "document_id"), r.getInteger("seq"), r.getInteger("version"),
                r.getString("verdict"), reasons == null ? List.of() : Arrays.asList(reasons), r.getString("comment"),
                r.getString("reviewed_by"), time(r, "decided_at"));
    }
}
