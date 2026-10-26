package com.microboxlabs.miot.fleet.resources.store;

import static com.microboxlabs.miot.fleet.resources.store.Pg.query;
import static com.microboxlabs.miot.fleet.resources.store.Pg.text;
import static com.microboxlabs.miot.fleet.resources.store.Pg.time;

import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.fleet.resources.domain.Carrier;
import com.microboxlabs.miot.fleet.resources.domain.Driver;
import com.microboxlabs.miot.fleet.resources.domain.Trailer;
import com.microboxlabs.miot.fleet.resources.domain.Truck;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowIterator;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;

/** {@link ResourceStore} on the modulith database, schema {@code miot_fleet}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.fleet.enabled", stringValue = "true")
public class PgResourceStore implements ResourceStore {

    private static final String CARRIER_COLS = """
            id, tenant_code, external_id, rut, legal_name, transport_license, transport_license_expires,
            contact_name, phone, email, status, is_occasional, source_system, source_data::text AS source_data,
            created_at, created_by, updated_at, updated_by""";

    private static final String TRUCK_COLS = """
            id, tenant_code, carrier_id, external_id, license_plate, vin, truck_type, max_weight, volume,
            status, is_occasional, source_system, source_data::text AS source_data,
            created_at, created_by, updated_at, updated_by""";

    private static final String TRAILER_COLS = """
            id, tenant_code, carrier_id, external_id, license_plate, vin, trailer_type, max_weight,
            status, is_occasional, source_system, source_data::text AS source_data,
            created_at, created_by, updated_at, updated_by""";

    private static final String DRIVER_COLS = """
            id, tenant_code, carrier_id, external_id, rut, first_name, last_name, full_name, phone,
            mobile_phone, license_category, license_expires, status, is_occasional, source_system,
            source_data::text AS source_data, created_at, created_by, updated_at, updated_by""";

    private static final String TENANT_CODE = "tenant_code";
    private static final String EXTERNAL_ID = "external_id";
    private static final String STATUS = "status";
    private static final String IS_OCCASIONAL = "is_occasional";
    private static final String SOURCE_SYSTEM = "source_system";
    private static final String SOURCE_DATA = "source_data";
    private static final String CREATED_AT = "created_at";
    private static final String CREATED_BY = "created_by";
    private static final String UPDATED_AT = "updated_at";
    private static final String UPDATED_BY = "updated_by";
    private static final String CARRIER_ID = "carrier_id";
    private static final String LICENSE_PLATE = "license_plate";
    private static final String ID = "id";
    private static final String RUT = "rut";
    private static final String LEGAL_NAME = "legal_name";
    private static final String FULL_NAME = "full_name";
    private static final String PHONE = "phone";

    private static final String BY_ID = " AND id = $2";
    private static final String CARRIER = "carrier";
    private static final String TRUCK = "truck";
    private static final String TRAILER = "trailer";
    private static final String DRIVER = "driver";
    private static final Set<String> RESOURCE_TABLES = Set.of(CARRIER, TRUCK, TRAILER, DRIVER);

    private final Supplier<Pool> pool;

    @Inject
    PgResourceStore(Instance<Pool> pool) {
        this(pool::get);
    }

    public PgResourceStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    // ---- carriers -------------------------------------------------------

    @Override
    public Carrier insertCarrier(Carrier c) {
        return carrier(query(pool.get(), """
                INSERT INTO miot_fleet.carrier
                    (tenant_code, external_id, rut, legal_name, transport_license, transport_license_expires,
                     contact_name, phone, email, status, is_occasional, source_system, created_by, updated_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
                RETURNING\s""" + CARRIER_COLS,
                Tuple.tuple().addString(c.tenantCode()).addString(c.externalId()).addString(c.rut())
                        .addString(c.legalName()).addString(c.transportLicense())
                        .addOffsetDateTime(c.transportLicenseExpires()).addString(c.contactName())
                        .addString(c.phone()).addString(c.email()).addString(c.status())
                        .addBoolean(c.isOccasional()).addString(c.sourceSystem()).addString(c.createdBy()))
                .iterator().next());
    }

    @Override
    public Optional<Carrier> findCarrier(String tenantCode, UUID id) {
        return first(query(pool.get(),
                select(CARRIER_COLS, CARRIER) + BY_ID + Pg.lock(),
                Tuple.of(tenantCode, id)), PgResourceStore::carrier);
    }

    @Override
    public List<Carrier> listCarriers(String tenantCode, String q, int page, int size) {
        return listCarriers(tenantCode, q, page, size, false);
    }

    @Override
    public List<Carrier> listActiveCarriers(String tenantCode, String q, int limit) {
        return listCarriers(tenantCode, q, 0, limit, true);
    }

    private List<Carrier> listCarriers(String tenantCode, String q, int page, int size, boolean activeOnly) {
        StringBuilder sql = new StringBuilder(select(CARRIER_COLS, CARRIER));
        Tuple params = Tuple.of(tenantCode);
        if (activeOnly) {
            params.addString(Carrier.INACTIVE);
            sql.append(" AND status <> $").append(params.size());
        }
        if (q != null) {
            params.addString(contains(q));
            int n = params.size();
            sql.append(" AND (rut ILIKE $").append(n).append(" OR legal_name ILIKE $").append(n).append(')');
        }
        page(sql, params, LEGAL_NAME, page, size);
        return query(pool.get(), sql.toString(), params).stream().map(PgResourceStore::carrier).toList();
    }

    @Override
    public Optional<Carrier> updateCarrier(Carrier c) {
        return first(query(pool.get(), """
                UPDATE miot_fleet.carrier SET
                    external_id = $3, rut = $4, legal_name = $5, transport_license = $6,
                    transport_license_expires = $7, contact_name = $8, phone = $9, email = $10,
                    status = $11, is_occasional = $12, updated_by = $13, updated_at = now()
                WHERE id = $1 AND tenant_code = $2
                RETURNING\s""" + CARRIER_COLS,
                Tuple.tuple().addUUID(Pg.parse(c.id())).addString(c.tenantCode())
                        .addString(c.externalId()).addString(c.rut()).addString(c.legalName())
                        .addString(c.transportLicense()).addOffsetDateTime(c.transportLicenseExpires())
                        .addString(c.contactName()).addString(c.phone()).addString(c.email())
                        .addString(c.status()).addBoolean(c.isOccasional()).addString(c.updatedBy())),
                PgResourceStore::carrier);
    }

    // ---- trucks ---------------------------------------------------------

    @Override
    public Truck insertTruck(Truck t) {
        return truck(query(pool.get(), """
                INSERT INTO miot_fleet.truck
                    (tenant_code, carrier_id, external_id, license_plate, vin, truck_type, max_weight, volume,
                     status, is_occasional, source_system, created_by, updated_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
                RETURNING\s""" + TRUCK_COLS,
                Tuple.tuple().addString(t.tenantCode()).addUUID(Pg.parse(t.carrierId()))
                        .addString(t.externalId()).addString(t.licensePlate()).addString(t.vin())
                        .addString(t.truckType()).addBigDecimal(t.maxWeight()).addBigDecimal(t.volume())
                        .addString(t.status()).addBoolean(t.isOccasional()).addString(t.sourceSystem())
                        .addString(t.createdBy()))
                .iterator().next());
    }

    @Override
    public Optional<Truck> findTruck(String tenantCode, UUID id) {
        return first(query(pool.get(),
                select(TRUCK_COLS, TRUCK) + BY_ID + Pg.lock(),
                Tuple.of(tenantCode, id)), PgResourceStore::truck);
    }

    @Override
    public List<Truck> listTrucks(String tenantCode, String plate, UUID carrierId, int page, int size) {
        StringBuilder sql = new StringBuilder(select(TRUCK_COLS, TRUCK));
        Tuple params = Tuple.of(tenantCode);
        if (plate != null) {
            params.addString(contains(plate));
            sql.append(" AND license_plate ILIKE $").append(params.size());
        }
        if (carrierId != null) {
            params.addUUID(carrierId);
            sql.append(" AND carrier_id = $").append(params.size());
        }
        page(sql, params, LICENSE_PLATE, page, size);
        return query(pool.get(), sql.toString(), params).stream().map(PgResourceStore::truck).toList();
    }

    @Override
    public Optional<Truck> updateTruck(Truck t) {
        return first(query(pool.get(), """
                UPDATE miot_fleet.truck SET
                    carrier_id = $3, external_id = $4, license_plate = $5, vin = $6, truck_type = $7,
                    max_weight = $8, volume = $9, status = $10, is_occasional = $11, updated_by = $12, updated_at = now()
                WHERE id = $1 AND tenant_code = $2
                RETURNING\s""" + TRUCK_COLS,
                Tuple.tuple().addUUID(Pg.parse(t.id())).addString(t.tenantCode())
                        .addUUID(Pg.parse(t.carrierId())).addString(t.externalId())
                        .addString(t.licensePlate()).addString(t.vin()).addString(t.truckType())
                        .addBigDecimal(t.maxWeight()).addBigDecimal(t.volume()).addString(t.status())
                        .addBoolean(t.isOccasional()).addString(t.updatedBy())),
                PgResourceStore::truck);
    }

    // ---- trailers -------------------------------------------------------

    @Override
    public Trailer insertTrailer(Trailer t) {
        return trailer(query(pool.get(), """
                INSERT INTO miot_fleet.trailer
                    (tenant_code, carrier_id, external_id, license_plate, vin, trailer_type, max_weight,
                     status, is_occasional, source_system, created_by, updated_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
                RETURNING\s""" + TRAILER_COLS,
                Tuple.tuple().addString(t.tenantCode()).addUUID(Pg.parse(t.carrierId()))
                        .addString(t.externalId()).addString(t.licensePlate()).addString(t.vin())
                        .addString(t.trailerType()).addBigDecimal(t.maxWeight()).addString(t.status())
                        .addBoolean(t.isOccasional()).addString(t.sourceSystem()).addString(t.createdBy()))
                .iterator().next());
    }

    @Override
    public Optional<Trailer> findTrailer(String tenantCode, UUID id) {
        return first(query(pool.get(),
                select(TRAILER_COLS, TRAILER) + BY_ID + Pg.lock(),
                Tuple.of(tenantCode, id)), PgResourceStore::trailer);
    }

    @Override
    public List<Trailer> listTrailers(String tenantCode, String plate, int page, int size) {
        StringBuilder sql = new StringBuilder(select(TRAILER_COLS, TRAILER));
        Tuple params = Tuple.of(tenantCode);
        if (plate != null) {
            params.addString(contains(plate));
            sql.append(" AND license_plate ILIKE $").append(params.size());
        }
        page(sql, params, LICENSE_PLATE, page, size);
        return query(pool.get(), sql.toString(), params).stream().map(PgResourceStore::trailer).toList();
    }

    @Override
    public Optional<Trailer> updateTrailer(Trailer t) {
        return first(query(pool.get(), """
                UPDATE miot_fleet.trailer SET
                    carrier_id = $3, external_id = $4, license_plate = $5, vin = $6, trailer_type = $7,
                    max_weight = $8, status = $9, is_occasional = $10, updated_by = $11, updated_at = now()
                WHERE id = $1 AND tenant_code = $2
                RETURNING\s""" + TRAILER_COLS,
                Tuple.tuple().addUUID(Pg.parse(t.id())).addString(t.tenantCode())
                        .addUUID(Pg.parse(t.carrierId())).addString(t.externalId())
                        .addString(t.licensePlate()).addString(t.vin()).addString(t.trailerType())
                        .addBigDecimal(t.maxWeight()).addString(t.status()).addBoolean(t.isOccasional())
                        .addString(t.updatedBy())),
                PgResourceStore::trailer);
    }

    // ---- drivers --------------------------------------------------------

    @Override
    public Driver insertDriver(Driver d) {
        return driver(query(pool.get(), """
                INSERT INTO miot_fleet.driver
                    (tenant_code, carrier_id, external_id, rut, first_name, last_name, full_name, phone,
                     mobile_phone, license_category, license_expires, status, is_occasional, source_system,
                     created_by, updated_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
                RETURNING\s""" + DRIVER_COLS,
                Tuple.tuple().addString(d.tenantCode()).addUUID(Pg.parse(d.carrierId()))
                        .addString(d.externalId()).addString(d.rut()).addString(d.firstName())
                        .addString(d.lastName()).addString(d.fullName()).addString(d.phone())
                        .addString(d.mobilePhone()).addString(d.licenseCategory())
                        .addOffsetDateTime(d.licenseExpires()).addString(d.status())
                        .addBoolean(d.isOccasional()).addString(d.sourceSystem()).addString(d.createdBy()))
                .iterator().next());
    }

    @Override
    public Optional<Driver> findDriver(String tenantCode, UUID id) {
        return first(query(pool.get(),
                select(DRIVER_COLS, DRIVER) + BY_ID + Pg.lock(),
                Tuple.of(tenantCode, id)), PgResourceStore::driver);
    }

    @Override
    public List<Driver> listDrivers(String tenantCode, String rut, String q, int page, int size) {
        StringBuilder sql = new StringBuilder(select(DRIVER_COLS, DRIVER));
        Tuple params = Tuple.of(tenantCode);
        if (rut != null) {
            params.addString(rut);
            sql.append(" AND rut = $").append(params.size());
        }
        if (q != null) {
            params.addString(contains(q));
            sql.append(" AND full_name ILIKE $").append(params.size());
        }
        page(sql, params, FULL_NAME, page, size);
        return query(pool.get(), sql.toString(), params).stream().map(PgResourceStore::driver).toList();
    }

    @Override
    public Optional<Driver> updateDriver(Driver d) {
        return first(query(pool.get(), """
                UPDATE miot_fleet.driver SET
                    carrier_id = $3, external_id = $4, rut = $5, first_name = $6, last_name = $7,
                    full_name = $8, phone = $9, mobile_phone = $10, license_category = $11,
                    license_expires = $12, status = $13, is_occasional = $14, updated_by = $15, updated_at = now()
                WHERE id = $1 AND tenant_code = $2
                RETURNING\s""" + DRIVER_COLS,
                Tuple.tuple().addUUID(Pg.parse(d.id())).addString(d.tenantCode())
                        .addUUID(Pg.parse(d.carrierId())).addString(d.externalId()).addString(d.rut())
                        .addString(d.firstName()).addString(d.lastName()).addString(d.fullName())
                        .addString(d.phone()).addString(d.mobilePhone()).addString(d.licenseCategory())
                        .addOffsetDateTime(d.licenseExpires()).addString(d.status())
                        .addBoolean(d.isOccasional()).addString(d.updatedBy())),
                PgResourceStore::driver);
    }

    @Override
    public boolean isCurrent(String tenantCode, String table, UUID id) {
        if (!RESOURCE_TABLES.contains(table)) {
            throw new IllegalArgumentException("not a resource table: " + table);
        }
        return query(pool.get(), "SELECT EXISTS(" + select("1", table) + BY_ID
                + " AND is_active AND COALESCE(status, 'active') <> 'inactive')",
                Tuple.of(tenantCode, id)).iterator().next().getBoolean(0);
    }

    @Override
    public Optional<FleetResources.Vehicle> vehicle(String tenantCode, String table, UUID id) {
        return first(query(pool.get(), select("license_plate, carrier_id", table) + BY_ID, Tuple.of(tenantCode, id)),
                r -> new FleetResources.Vehicle(r.getString(LICENSE_PLATE), r.getUUID(CARRIER_ID)));
    }

    @Override
    public Optional<FleetResources.Driver> driverSummary(String tenantCode, UUID id) {
        return first(query(pool.get(), select("rut, full_name, COALESCE(mobile_phone, phone) AS phone", DRIVER)
                + BY_ID, Tuple.of(tenantCode, id)),
                r -> new FleetResources.Driver(r.getString(RUT), r.getString(FULL_NAME), r.getString(PHONE)));
    }

    @Override
    public Optional<FleetResources.Carrier> carrierSummary(String tenantCode, UUID id) {
        return first(query(pool.get(), select("id, legal_name, phone, rut", CARRIER) + BY_ID,
                Tuple.of(tenantCode, id)), r -> new FleetResources.Carrier(r.getUUID(ID), r.getString(LEGAL_NAME),
                        r.getString(PHONE), r.getString(RUT)));
    }

    @Override
    public Optional<FleetResources.Match> findByKey(String tenantCode, String table, String key) {
        String column = switch (table) {
            case TRUCK, TRAILER -> LICENSE_PLATE;
            case DRIVER, CARRIER -> RUT;
            default -> throw new IllegalArgumentException("not a keyed resource table: " + table);
        };
        return first(query(pool.get(), select("id, is_active AND COALESCE(status, 'active') <> 'inactive' AS usable",
                table) + " AND upper(regexp_replace(" + column + " COLLATE \"C\", '[^A-Za-z0-9]', '', 'g')) = $2"
                + " ORDER BY usable DESC, id LIMIT 1", Tuple.of(tenantCode, key)),
                r -> new FleetResources.Match(r.getUUID(ID), r.getBoolean("usable")));
    }

    // ---- shared ---------------------------------------------------------

    /** An ILIKE pattern that matches {@code term} literally: % and _ in user input are not wildcards. */
    private static String contains(String term) {
        return "%" + term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    private static void page(StringBuilder sql, Tuple params, String orderBy, int page, int size) {
        params.addInteger(size);
        sql.append(" ORDER BY ").append(orderBy).append(", id LIMIT $").append(params.size());
        params.addLong((long) page * size);
        sql.append(" OFFSET $").append(params.size());
    }

    /** The current rows of {@code table} in the tenant ($1). */
    private static String select(String cols, String table) {
        return "SELECT " + cols + " FROM miot_fleet." + table + " WHERE tenant_code = $1 AND version_of IS NULL";
    }

    private static <T> Optional<T> first(RowSet<Row> rows, Function<Row, T> map) {
        RowIterator<Row> it = rows.iterator();
        return it.hasNext() ? Optional.of(map.apply(it.next())) : Optional.empty();
    }

    private static Carrier carrier(Row r) {
        return new Carrier(text(r.getUUID(ID)), r.getString(TENANT_CODE), r.getString(EXTERNAL_ID),
                r.getString(RUT), r.getString(LEGAL_NAME), r.getString("transport_license"),
                time(r, "transport_license_expires"), r.getString("contact_name"), r.getString(PHONE),
                r.getString("email"), r.getString(STATUS), r.getBoolean(IS_OCCASIONAL),
                r.getString(SOURCE_SYSTEM), r.getString(SOURCE_DATA),
                time(r, CREATED_AT), r.getString(CREATED_BY), time(r, UPDATED_AT), r.getString(UPDATED_BY));
    }

    private static Truck truck(Row r) {
        return new Truck(text(r.getUUID(ID)), r.getString(TENANT_CODE), text(r.getUUID(CARRIER_ID)),
                r.getString(EXTERNAL_ID), r.getString(LICENSE_PLATE), r.getString("vin"),
                r.getString("truck_type"), r.getBigDecimal("max_weight"), r.getBigDecimal("volume"),
                r.getString(STATUS), r.getBoolean(IS_OCCASIONAL), r.getString(SOURCE_SYSTEM),
                r.getString(SOURCE_DATA),
                time(r, CREATED_AT), r.getString(CREATED_BY), time(r, UPDATED_AT), r.getString(UPDATED_BY));
    }

    private static Trailer trailer(Row r) {
        return new Trailer(text(r.getUUID(ID)), r.getString(TENANT_CODE), text(r.getUUID(CARRIER_ID)),
                r.getString(EXTERNAL_ID), r.getString(LICENSE_PLATE), r.getString("vin"),
                r.getString("trailer_type"), r.getBigDecimal("max_weight"),
                r.getString(STATUS), r.getBoolean(IS_OCCASIONAL), r.getString(SOURCE_SYSTEM),
                r.getString(SOURCE_DATA),
                time(r, CREATED_AT), r.getString(CREATED_BY), time(r, UPDATED_AT), r.getString(UPDATED_BY));
    }

    private static Driver driver(Row r) {
        return new Driver(text(r.getUUID(ID)), r.getString(TENANT_CODE), text(r.getUUID(CARRIER_ID)),
                r.getString(EXTERNAL_ID), r.getString(RUT), r.getString("first_name"),
                r.getString("last_name"), r.getString(FULL_NAME), r.getString(PHONE),
                r.getString("mobile_phone"), r.getString("license_category"), time(r, "license_expires"),
                r.getString(STATUS), r.getBoolean(IS_OCCASIONAL), r.getString(SOURCE_SYSTEM),
                r.getString(SOURCE_DATA),
                time(r, CREATED_AT), r.getString(CREATED_BY), time(r, UPDATED_AT), r.getString(UPDATED_BY));
    }
}
