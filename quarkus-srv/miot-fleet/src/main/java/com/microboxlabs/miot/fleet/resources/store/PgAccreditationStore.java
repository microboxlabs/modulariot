package com.microboxlabs.miot.fleet.resources.store;

import static com.microboxlabs.miot.fleet.resources.store.Pg.query;
import static com.microboxlabs.miot.fleet.resources.store.Pg.text;
import static com.microboxlabs.miot.fleet.resources.store.Pg.time;

import com.microboxlabs.miot.fleet.resources.domain.ResourceAttribute;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link AccreditationStore} on the modulith database, schema {@code miot_fleet}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.fleet.enabled", stringValue = "true")
public class PgAccreditationStore implements AccreditationStore {

    private static final String COLUMNS = """
            id, tenant_code, resource_type, resource_id, attribute_type, attribute_key, attribute_value,
            context::text AS context, valid_from, valid_until, source_system,
            created_at, created_by, updated_at, updated_by""";

    private static final String UPSERT = """
            INSERT INTO miot_fleet.resource_attribute
                (tenant_code, resource_type, resource_id, attribute_type, attribute_key, attribute_value,
                 context, valid_from, valid_until, source_system, created_by, updated_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7::text::jsonb, $8, $9, $10, $11, $11)
            ON CONFLICT (tenant_code, resource_type, resource_id, attribute_type, attribute_key)
                WHERE version_of IS NULL AND is_active
            DO UPDATE SET
                attribute_value = EXCLUDED.attribute_value,
                context = EXCLUDED.context,
                valid_from = EXCLUDED.valid_from,
                valid_until = EXCLUDED.valid_until,
                source_system = EXCLUDED.source_system,
                updated_by = EXCLUDED.updated_by, updated_at = now()
            RETURNING\s""" + COLUMNS;

    private final Supplier<Pool> pool;

    @Inject
    PgAccreditationStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgAccreditationStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public ResourceAttribute upsert(ResourceAttribute a) {
        Tuple params = Tuple.tuple()
                .addString(a.tenantCode()).addString(a.resourceType()).addUUID(Pg.parse(a.resourceId()))
                .addString(a.attributeType()).addString(a.attributeKey()).addString(a.attributeValue())
                .addString(a.context()).addOffsetDateTime(a.validFrom()).addOffsetDateTime(a.validUntil())
                .addString(a.sourceSystem()).addString(a.createdBy());
        return attribute(query(pool.get(), UPSERT, params).iterator().next());
    }

    @Override
    public List<ResourceAttribute> listByResource(String tenantCode, String resourceType, UUID resourceId) {
        return query(pool.get(),
                "SELECT " + COLUMNS + """
                 FROM miot_fleet.resource_attribute
                WHERE tenant_code = $1 AND resource_type = $2 AND resource_id = $3
                  AND version_of IS NULL AND is_active
                ORDER BY attribute_type, attribute_key""",
                Tuple.of(tenantCode, resourceType, resourceId))
                .stream().map(PgAccreditationStore::attribute).toList();
    }

    @Override
    public List<AccreditedRow> accredited(String tenantCode, String attributeType, String attributeKey,
            List<String> values, OffsetDateTime at) {
        RowSet<Row> rows = query(pool.get(), """
                SELECT ra.resource_type, ra.resource_id, ra.attribute_value, ra.valid_until, res.label
                FROM miot_fleet.resource_attribute ra
                LEFT JOIN LATERAL (
                    SELECT t.license_plate AS label, t.status FROM miot_fleet.truck t
                     WHERE ra.resource_type = 'truck' AND t.id = ra.resource_id AND t.tenant_code = ra.tenant_code
                    UNION ALL
                    SELECT t.license_plate, t.status FROM miot_fleet.trailer t
                     WHERE ra.resource_type = 'trailer' AND t.id = ra.resource_id AND t.tenant_code = ra.tenant_code
                    UNION ALL
                    SELECT d.full_name, d.status FROM miot_fleet.driver d
                     WHERE ra.resource_type = 'driver' AND d.id = ra.resource_id AND d.tenant_code = ra.tenant_code
                    UNION ALL
                    SELECT c.legal_name, c.status FROM miot_fleet.carrier c
                     WHERE ra.resource_type = 'carrier' AND c.id = ra.resource_id AND c.tenant_code = ra.tenant_code
                ) res ON TRUE
                WHERE ra.tenant_code = $1 AND ra.attribute_type = $2 AND ra.attribute_key = $3
                  AND ra.version_of IS NULL AND ra.is_active
                  AND ra.attribute_value = ANY($4)
                  AND (ra.valid_from IS NULL OR ra.valid_from <= $5)
                  AND (ra.valid_until IS NULL OR ra.valid_until >= $5)
                  AND COALESCE(res.status, 'active') <> 'inactive'
                ORDER BY ra.resource_type, res.label, ra.resource_id""",
                Tuple.tuple().addString(tenantCode).addString(attributeType).addString(attributeKey)
                        .addArrayOfString(values.toArray(String[]::new)).addOffsetDateTime(at));
        return rows.stream().map(r -> new AccreditedRow(r.getString("resource_type"),
                text(r.getUUID("resource_id")), r.getString("label"), r.getString("attribute_value"),
                time(r, "valid_until"))).toList();
    }

    private static ResourceAttribute attribute(Row r) {
        return new ResourceAttribute(
                text(r.getUUID("id")), r.getString("tenant_code"), r.getString("resource_type"),
                text(r.getUUID("resource_id")), r.getString("attribute_type"), r.getString("attribute_key"),
                r.getString("attribute_value"), r.getString("context"),
                time(r, "valid_from"), time(r, "valid_until"), r.getString("source_system"),
                time(r, "created_at"), r.getString("created_by"), time(r, "updated_at"), r.getString("updated_by"));
    }
}
