package com.microboxlabs.miot.trips.store;

import static com.microboxlabs.miot.trips.store.Pg.query;
import static com.microboxlabs.miot.trips.store.Pg.time;

import com.fasterxml.jackson.core.type.TypeReference;
import com.microboxlabs.miot.trips.domain.Delivery;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link DeliveryStore} on the modulith database, schema {@code miot_trips}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class PgDeliveryStore implements DeliveryStore {

    private static final String COLUMNS = "d.id, d.tenant_code, d.trip_id, d.reference, d.customer, d.source,"
            + " d.evidence, d.note, d.created_at, d.created_by, d.updated_at, d.updated_by,"
            + " ARRAY(SELECT dm.mandate_id::text FROM miot_trips.delivery_mandate dm WHERE dm.delivery_id = d.id"
            + " ORDER BY dm.mandate_id) AS mandate_ids";
    private static final String STEP_COLUMNS = "s.delivery_id, s.step, s.tenant_code, s.status, s.source,"
            + " s.proposed_at, s.evidence, s.confirmed_at, s.confirmed_by, s.channel, s.note, s.updated_at,"
            + " s.updated_by";
    private static final String PROOF_COLUMNS = "p.id, p.delivery_id, p.tenant_code, p.kind, p.content_id, p.url,"
            + " p.name, p.mimetype, p.metadata, p.source, p.received_at, p.received_by";
    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {
    };

    private final Supplier<Pool> pool;

    @Inject
    PgDeliveryStore(Instance<Pool> pool) {
        this(pool::get);
    }

    public PgDeliveryStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public List<Delivery> list(String tenantCode, UUID tripId) {
        return query(pool.get(), "SELECT " + COLUMNS + " FROM miot_trips.delivery d"
                + " WHERE d.tenant_code = $1 AND d.trip_id = $2 ORDER BY d.created_at, d.id",
                Tuple.of(tenantCode, tripId)).stream().map(PgDeliveryStore::delivery).toList();
    }

    @Override
    public Optional<Delivery> find(String tenantCode, UUID tripId, UUID deliveryId) {
        return query(pool.get(), "SELECT " + COLUMNS + " FROM miot_trips.delivery d"
                + " WHERE d.tenant_code = $1 AND d.trip_id = $2 AND d.id = $3" + Pg.lock(),
                Tuple.of(tenantCode, tripId, deliveryId)).stream().map(PgDeliveryStore::delivery).findFirst();
    }

    @Override
    public Optional<Delivery> findByReference(String tenantCode, UUID tripId, String reference) {
        return query(pool.get(), "SELECT " + COLUMNS + " FROM miot_trips.delivery d"
                + " WHERE d.tenant_code = $1 AND d.trip_id = $2 AND d.reference = $3" + Pg.lock(),
                Tuple.of(tenantCode, tripId, reference)).stream().map(PgDeliveryStore::delivery).findFirst();
    }

    @Override
    public Delivery insert(Delivery d) {
        UUID id = UUID.fromString(d.id());
        UUID tripId = UUID.fromString(d.tripId());
        query(pool.get(), """
                INSERT INTO miot_trips.delivery (id, tenant_code, trip_id, reference, customer, source, evidence, note,
                    created_by, updated_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7::text::jsonb, $8, $9, $9)""",
                Tuple.tuple().addUUID(id).addString(d.tenantCode()).addUUID(tripId).addString(d.reference())
                        .addString(d.customer()).addString(d.source()).addString(Pg.json(d.evidence()))
                        .addString(d.note()).addString(d.createdBy()));
        if (!d.mandateIds().isEmpty()) {
            query(pool.get(), """
                    INSERT INTO miot_trips.delivery_mandate (delivery_id, trip_id, mandate_id)
                    SELECT $1, $2, m FROM unnest($3::uuid[]) AS m""",
                    Tuple.of(id, tripId, d.mandateIds().stream().map(UUID::fromString).toArray(UUID[]::new)));
        }
        return find(d.tenantCode(), tripId, id).orElseThrow();
    }

    @Override
    public Delivery update(Delivery d) {
        query(pool.get(), """
                UPDATE miot_trips.delivery SET customer = $3, evidence = $4::text::jsonb, note = $5,
                    updated_at = now(), updated_by = $6
                WHERE tenant_code = $1 AND id = $2""",
                Tuple.tuple().addString(d.tenantCode()).addUUID(UUID.fromString(d.id())).addString(d.customer())
                        .addString(Pg.json(d.evidence())).addString(d.note()).addString(d.updatedBy()));
        return find(d.tenantCode(), UUID.fromString(d.tripId()), UUID.fromString(d.id())).orElseThrow();
    }

    @Override
    public List<Delivery.Step> steps(String tenantCode, UUID tripId) {
        return query(pool.get(), "SELECT " + STEP_COLUMNS + " FROM miot_trips.delivery_step s"
                + " JOIN miot_trips.delivery d ON d.id = s.delivery_id"
                + " WHERE d.tenant_code = $1 AND d.trip_id = $2", Tuple.of(tenantCode, tripId))
                .stream().map(PgDeliveryStore::step).toList();
    }

    @Override
    public Optional<Delivery.Step> step(String tenantCode, UUID deliveryId, String step) {
        return query(pool.get(), "SELECT " + STEP_COLUMNS + " FROM miot_trips.delivery_step s"
                + " WHERE s.tenant_code = $1 AND s.delivery_id = $2 AND s.step = $3" + Pg.lock(),
                Tuple.of(tenantCode, deliveryId, step)).stream().map(PgDeliveryStore::step).findFirst();
    }

    @Override
    public Delivery.Step save(Delivery.Step s) {
        return query(pool.get(), """
                INSERT INTO miot_trips.delivery_step AS s (delivery_id, step, tenant_code, status, source, proposed_at,
                    evidence, confirmed_at, confirmed_by, channel, note, updated_by)
                VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::text::jsonb, $8::timestamptz, $9, $10, $11, $12)
                ON CONFLICT (delivery_id, step) DO UPDATE SET status = EXCLUDED.status, source = EXCLUDED.source,
                    proposed_at = EXCLUDED.proposed_at, evidence = EXCLUDED.evidence,
                    confirmed_at = EXCLUDED.confirmed_at, confirmed_by = EXCLUDED.confirmed_by,
                    channel = EXCLUDED.channel, note = EXCLUDED.note, updated_at = now(),
                    updated_by = EXCLUDED.updated_by
                RETURNING\s""" + STEP_COLUMNS,
                Tuple.tuple().addUUID(UUID.fromString(s.deliveryId())).addString(s.step())
                        .addString(s.tenantCode()).addString(s.status()).addString(s.source())
                        .addOffsetDateTime(s.proposedAt()).addString(Pg.json(s.evidence()))
                        .addOffsetDateTime(s.confirmedAt()).addString(s.confirmedBy()).addString(s.channel())
                        .addString(s.note()).addString(s.updatedBy()))
                .stream().map(PgDeliveryStore::step).findFirst().orElseThrow();
    }

    @Override
    public List<Delivery.Proof> proofs(String tenantCode, UUID tripId) {
        return query(pool.get(), "SELECT " + PROOF_COLUMNS + " FROM miot_trips.delivery_proof p"
                + " JOIN miot_trips.delivery d ON d.id = p.delivery_id"
                + " WHERE d.tenant_code = $1 AND d.trip_id = $2 ORDER BY p.received_at, p.id",
                Tuple.of(tenantCode, tripId)).stream().map(PgDeliveryStore::proof).toList();
    }

    @Override
    public Delivery.Proof insert(Delivery.Proof p) {
        return query(pool.get(), """
                INSERT INTO miot_trips.delivery_proof AS p (id, delivery_id, tenant_code, kind, content_id, url, name,
                    mimetype, metadata, source, received_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text::jsonb, $10, $11)
                RETURNING\s""" + PROOF_COLUMNS,
                Tuple.tuple().addUUID(UUID.fromString(p.id())).addUUID(UUID.fromString(p.deliveryId()))
                        .addString(p.tenantCode()).addString(p.kind()).addUUID(Pg.parse(p.contentId()))
                        .addString(p.url()).addString(p.name()).addString(p.mimetype())
                        .addString(Pg.json(p.metadata())).addString(p.source()).addString(p.receivedBy()))
                .stream().map(PgDeliveryStore::proof).findFirst().orElseThrow();
    }

    @Override
    public void deleteProof(String tenantCode, UUID proofId) {
        query(pool.get(), "DELETE FROM miot_trips.delivery_proof WHERE tenant_code = $1 AND id = $2",
                Tuple.of(tenantCode, proofId));
    }

    private static Delivery delivery(Row r) {
        String[] mandates = r.getArrayOfStrings("mandate_ids");
        return new Delivery(Pg.text(r, "id"), r.getString("tenant_code"), Pg.text(r, "trip_id"),
                r.getString("reference"), r.getString("customer"), r.getString("source"),
                Pg.json(r, "evidence", MAP), r.getString("note"),
                mandates == null ? List.of() : Arrays.asList(mandates), time(r, "created_at"),
                r.getString("created_by"), time(r, "updated_at"), r.getString("updated_by"));
    }

    private static Delivery.Step step(Row r) {
        return new Delivery.Step(Pg.text(r, "delivery_id"), r.getString("step"), r.getString("tenant_code"),
                r.getString("status"), r.getString("source"), time(r, "proposed_at"), Pg.json(r, "evidence", MAP),
                time(r, "confirmed_at"), r.getString("confirmed_by"), r.getString("channel"), r.getString("note"),
                time(r, "updated_at"), r.getString("updated_by"));
    }

    private static Delivery.Proof proof(Row r) {
        return new Delivery.Proof(Pg.text(r, "id"), Pg.text(r, "delivery_id"), r.getString("tenant_code"),
                r.getString("kind"), Pg.text(r, "content_id"), r.getString("url"), r.getString("name"),
                r.getString("mimetype"), Pg.json(r, "metadata", MAP), r.getString("source"),
                time(r, "received_at"), r.getString("received_by"));
    }
}
