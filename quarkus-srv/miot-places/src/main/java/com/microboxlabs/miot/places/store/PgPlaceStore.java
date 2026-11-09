package com.microboxlabs.miot.places.store;

import com.microboxlabs.miot.core.db.PgTx;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowIterator;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link PlaceStore} on the modulith database, schema {@code miot_places}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.places.enabled", stringValue = "true")
public class PgPlaceStore implements PlaceStore {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final String ACTIVE = " AND is_active";
    // as idx_place_sync_pending says it, so the pending read uses the index
    private static final String SYNCED_KINDS = " AND kind IN ('geofence', 'inner_geofence')";
    private static final String PENDING = " WHERE kind IN ('geofence', 'inner_geofence')"
            + " AND (synced_at IS NULL OR synced_at < updated_at)";
    private static final String SELECT = "SELECT ";
    private static final String FROM = " FROM ";
    private static final String UPDATE = "UPDATE ";
    private static final String COLUMNS = """
            id, tenant_code, kind, parent_id, external_code, name, icon, color, address,
            categories::text AS categories, metadata::text AS metadata, geojson::text AS geojson, valid_from,
            valid_until, current_version,
            created_at, created_by, updated_at, updated_by""";
    private static final String VERSION_COLUMNS = """
            id, place_id, tenant_code, version, bump, reason, changes::text AS changes,
            snapshot::text AS snapshot, created_by, created_at""";

    private final Supplier<Pool> pool;
    private final String table;
    private final String versionTable;

    @Inject
    PgPlaceStore(Instance<Pool> pool) {
        this(pool::get);
    }

    public PgPlaceStore(Supplier<Pool> pool) {
        this(pool, "miot_places");
    }

    /** On {@code schema} instead of {@code miot_places}: tests use a scratch schema. */
    public PgPlaceStore(Supplier<Pool> pool, String schema) {
        this.pool = pool;
        this.table = schema + ".place";
        this.versionTable = schema + ".place_version";
    }

    @Override
    public Place insert(Place p) {
        return place(query("INSERT INTO " + table + """
                     (tenant_code, kind, parent_id, external_code, name, icon, color, address, categories,
                     metadata, geojson, valid_from, valid_until, current_version, created_by, updated_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text::jsonb, $10::text::jsonb, $11::text::jsonb, $12, $13,
                     $14, COALESCE($15, 'system'), $15)
                RETURNING\s""" + COLUMNS,
                Tuple.tuple().addString(p.tenantCode()).addString(p.kind()).addUUID(p.parentId())
                        .addString(p.externalCode()).addString(p.name()).addString(p.icon()).addString(p.color())
                        .addString(p.address()).addString(p.categoriesJson())
                        .addString(p.metadataJson()).addString(p.geojson()).addOffsetDateTime(p.validFrom())
                        .addOffsetDateTime(p.validUntil()).addString(p.currentVersion())
                        .addString(p.createdBy()))
                .iterator().next());
    }

    @Override
    public Optional<Place> find(String tenantCode, UUID id) {
        return first(query(SELECT + COLUMNS + FROM + table + " WHERE tenant_code = $1 AND id = $2"
                + ACTIVE + PgTx.lock(), Tuple.of(tenantCode, id)));
    }

    @Override
    public Optional<CodeOwner> findByCode(String tenantCode, String code) {
        RowIterator<Row> it = query(SELECT + "id, name, kind, external_code" + FROM + table
                + " WHERE tenant_code = $1 AND lower(external_code) = lower($2)"
                + ACTIVE, Tuple.of(tenantCode, code)).iterator();
        if (!it.hasNext()) {
            return Optional.empty();
        }
        Row r = it.next();
        return Optional.of(new CodeOwner(r.getUUID("id"), r.getString("name"), r.getString("kind"),
                r.getString("external_code")));
    }

    @Override
    public List<Place> list(String tenantCode, String kind, UUID parentId, String q, int limit, long offset) {
        StringBuilder sql = new StringBuilder(SELECT).append(COLUMNS)
                .append(FROM).append(table).append(" WHERE tenant_code = $1").append(ACTIVE);
        Tuple params = Tuple.of(tenantCode);
        if (kind != null) {
            params.addString(kind);
            sql.append(" AND kind = $").append(params.size());
        }
        if (parentId != null) {
            params.addUUID(parentId);
            sql.append(" AND parent_id = $").append(params.size());
        }
        if (q != null) {
            // the text is matched literally: backslash (Postgres's default LIKE escape), % and _ are escaped
            params.addString("%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%");
            int n = params.size();
            sql.append(" AND (name ILIKE $").append(n).append(" OR external_code ILIKE $").append(n).append(')');
        }
        params.addInteger(limit);
        sql.append(" ORDER BY name, id LIMIT $").append(params.size());
        params.addLong(offset);
        sql.append(" OFFSET $").append(params.size());
        return query(sql.toString(), params).stream().map(PgPlaceStore::place).toList();
    }

    @Override
    public List<Place> children(String tenantCode, UUID parentId) {
        return query(SELECT + COLUMNS + FROM + table + " WHERE tenant_code = $1 AND parent_id = $2" + ACTIVE
                + " ORDER BY name, id", Tuple.of(tenantCode, parentId)).stream().map(PgPlaceStore::place).toList();
    }

    @Override
    public Optional<Place> update(Place p) {
        return first(query(UPDATE + table + """
                 SET parent_id = $3, external_code = $4, name = $5, icon = $6, color = $7, address = $8,
                    categories = $9::text::jsonb, metadata = $10::text::jsonb, geojson = $11::text::jsonb,
                    valid_from = $12, valid_until = $13, current_version = $14, updated_by = $15
                WHERE tenant_code = $1 AND id = $2""" + ACTIVE + " RETURNING " + COLUMNS,
                Tuple.tuple().addString(p.tenantCode()).addUUID(p.id()).addUUID(p.parentId())
                        .addString(p.externalCode()).addString(p.name()).addString(p.icon()).addString(p.color())
                        .addString(p.address()).addString(p.categoriesJson())
                        .addString(p.metadataJson()).addString(p.geojson()).addOffsetDateTime(p.validFrom())
                        .addOffsetDateTime(p.validUntil()).addString(p.currentVersion())
                        .addString(p.updatedBy())));
    }

    @Override
    public boolean delete(String tenantCode, String externalCode, String actor) {
        // uq_place_code: at most one active place holds the code
        return query(UPDATE + table + " SET is_active = FALSE, updated_by = $3"
                + " WHERE tenant_code = $1 AND lower(external_code) = lower($2)" + ACTIVE,
                Tuple.of(tenantCode, externalCode, actor)).rowCount() > 0;
    }

    @Override
    public PlaceVersion insertVersion(PlaceVersion v) {
        return version(query("INSERT INTO " + versionTable + """
                     (place_id, tenant_code, version, bump, reason, changes, snapshot, created_by)
                VALUES ($1, $2, $3, $4, $5, $6::text::jsonb, $7::text::jsonb, COALESCE($8, 'system'))
                RETURNING\s""" + VERSION_COLUMNS,
                Tuple.tuple().addUUID(v.placeId()).addString(v.tenantCode()).addString(v.version())
                        .addString(v.bump()).addString(v.reason()).addString(v.changesJson())
                        .addString(v.snapshotJson()).addString(v.createdBy()))
                .iterator().next());
    }

    @Override
    public List<PlaceVersion> versions(String tenantCode, UUID placeId) {
        return query(SELECT + VERSION_COLUMNS + FROM + versionTable
                + " WHERE tenant_code = $1 AND place_id = $2 ORDER BY created_at, id", Tuple.of(tenantCode, placeId))
                .stream().map(PgPlaceStore::version).toList();
    }

    @Override
    public boolean markSynced(Place p, boolean deleted) {
        // a saved place only as it was saved: an edit since keeps it pending. now() is never before updated_at,
        // so the place leaves the pending ones, and the trigger leaves updated_at alone
        String sql = UPDATE + table + " SET synced_at = now() WHERE tenant_code = $1 AND id = $2" + SYNCED_KINDS
                + (deleted ? " AND NOT is_active" : ACTIVE + " AND updated_at = $3");
        Tuple params = Tuple.of(p.tenantCode(), p.id());
        if (!deleted) {
            params.addOffsetDateTime(p.updatedAt());
        }
        return query(sql, params).rowCount() > 0;
    }

    @Override
    public void markPending(Place p) {
        // only synced_at changes, so the trigger leaves updated_at alone
        query(UPDATE + table + " SET synced_at = NULL WHERE tenant_code = $1 AND id = $2" + SYNCED_KINDS,
                Tuple.of(p.tenantCode(), p.id()));
    }

    @Override
    public List<Pending> pending(int limit) {
        return query(SELECT + COLUMNS + ", is_active" + FROM + table + PENDING
                + " ORDER BY is_active, updated_at, id LIMIT $1", Tuple.of(limit))
                .stream().map(r -> new Pending(place(r), !r.getBoolean("is_active"))).toList();
    }

    /** Runs on the open transaction ({@link PgTx}) when there is one; constraint violations become 400/409. */
    private RowSet<Row> query(String sql, Tuple params) {
        try {
            return PgTx.client(pool.get()).preparedQuery(sql).execute(params).await().atMost(TIMEOUT);
        } catch (PgException e) {
            PgTx.statementFailed();
            throw translate(e);
        }
    }

    private static RuntimeException translate(PgException e) {
        return switch (e.getSqlState() == null ? "" : e.getSqlState()) {
            case "23505" -> new IllegalStateException("uq_place_version_number".equals(e.getConstraint())
                    ? "another edit saved that version first; reload and try again"
                    : "another current place of the organization has that code");
            case "23503" -> new IllegalArgumentException("a referenced place does not exist");
            case "23514" -> new IllegalArgumentException("a value is outside its allowed set");
            case "23502" -> new IllegalArgumentException("a required value is missing");
            case "22001" -> new IllegalArgumentException("a value is longer than its field allows");
            default -> PgTx.conflictOr(e);
        };
    }

    private static Optional<Place> first(RowSet<Row> rows) {
        RowIterator<Row> it = rows.iterator();
        return it.hasNext() ? Optional.of(place(it.next())) : Optional.empty();
    }

    private static Place place(Row r) {
        return new Place(r.getUUID("id"), r.getString("tenant_code"), r.getString("kind"), r.getUUID("parent_id"),
                r.getString("external_code"), r.getString("name"), r.getString("icon"), r.getString("color"),
                r.getString("address"), r.getString("categories"), r.getString("metadata"), r.getString("geojson"),
                time(r, "valid_from"), time(r, "valid_until"),
                r.getString("current_version"), time(r, "created_at"), r.getString("created_by"),
                time(r, "updated_at"), r.getString("updated_by"));
    }

    private static PlaceVersion version(Row r) {
        return new PlaceVersion(r.getUUID("id"), r.getUUID("place_id"), r.getString("tenant_code"),
                r.getString("version"), r.getString("bump"), r.getString("reason"), r.getString("changes"),
                r.getString("snapshot"), r.getString("created_by"), time(r, "created_at"));
    }

    /** Timestamps normalized to UTC so views compare equal across sessions. */
    private static OffsetDateTime time(Row r, String column) {
        OffsetDateTime value = r.getOffsetDateTime(column);
        return value == null ? null : value.withOffsetSameInstant(ZoneOffset.UTC);
    }
}
