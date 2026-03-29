package com.microboxlabs.miot.assignment.service;

import com.microboxlabs.miot.assignment.config.AssignmentConfig;
import com.microboxlabs.miot.assignment.config.AssignmentReactivePools;
import com.microboxlabs.miot.assignment.dto.CarrierSearchRequest;
import com.microboxlabs.miot.assignment.dto.CarrierSearchResponse;
import com.microboxlabs.miot.assignment.dto.ResourceSearchRequest;
import com.microboxlabs.miot.assignment.dto.ResourceSearchResponse;
import com.microboxlabs.miot.driver.model.Driver;
import com.microboxlabs.miot.fleet.model.Carrier;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.pgclient.PgPool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Stream;
import org.hibernate.reactive.mutiny.Mutiny;

@ApplicationScoped
public class TripResourceAssignmentService {

    private static final String ACTIVE_CARRIERS_QUERY = """
            from Carrier c
            where c.clientId = :clientId
              and c.active = true
            order by c.name, c.id
            """;

    private static final String ACTIVE_CARRIER_BY_ID_QUERY = """
            from Carrier c
            where c.clientId = :clientId
              and c.id = :carrierId
              and c.active = true
            """;

    private static final String CARRIER_DRIVER_METRICS_QUERY = """
            select d.carrierId,
                   count(d),
                   sum(case when d.active = true then 1L else 0L end),
                   sum(case when d.operationBlocked = true then 1L else 0L end),
                   sum(case when d.isOccasional = true then 1L else 0L end)
            from Driver d
            where d.clientId = :clientId
              and d.carrierId is not null
            group by d.carrierId
            """;

    private static final String DRIVERS_BY_CARRIER_QUERY = """
            from Driver d
            where d.clientId = :clientId
              and d.carrierId = :carrierId
              and d.active = true
            order by d.lastName, d.firstName, d.id
            """;

    @Inject
    Mutiny.SessionFactory sessionFactory;

    @Inject
    AssignmentConfig assignmentConfig;

    @Inject
    AssignmentReactivePools assignmentReactivePools;

    public Uni<CarrierSearchResponse> searchCarriers(String clientId, CarrierSearchRequest request) {
        validateCarrierSearchRequest(clientId, request);
        String normalizedClientId = clientId.trim();

        return Uni.combine().all().unis(
                loadActiveCarriers(normalizedClientId),
                loadCarrierDriverMetrics(normalizedClientId))
                .asTuple()
                .map(tuple -> toCarrierSearchResponse(tuple.getItem1(), tuple.getItem2()));
    }

    public Uni<ResourceSearchResponse> searchResources(String clientId, ResourceSearchRequest request) {
        validateResourceSearchRequest(clientId, request);
        ensureExternalLookupsEnabled();

        String normalizedClientId = clientId.trim();
        String normalizedRutMandante = normalizeAlphaNumeric(request.rutMandante());
        String normalizedDelegacion = normalizeUpper(request.delegacion());

        return findActiveCarrier(normalizedClientId, request.carrierId())
                .onItem().ifNull().failWith(() -> new WebApplicationException(
                        "Carrier not found: " + request.carrierId(), Response.Status.NOT_FOUND))
                .flatMap(ignored -> Uni.combine().all().unis(
                        loadDriversByCarrier(normalizedClientId, request.carrierId()),
                        loadTrucksByCarrier(normalizedClientId, request.carrierId()),
                        loadTrailersByCarrier(normalizedClientId, request.carrierId()))
                        .asTuple())
                .flatMap(resources -> {
                    List<Driver> drivers = resources.getItem1();
                    List<TruckResourceRow> trucks = resources.getItem2();
                    List<TrailerResourceRow> trailers = resources.getItem3();

                    return Uni.combine().all().unis(
                            loadDriverAccreditation(normalizedRutMandante, normalizedDelegacion, drivers),
                            loadTruckAccreditation(normalizedRutMandante, normalizedDelegacion, trucks),
                            loadDriverAssignments(drivers),
                            loadTruckAssignments(trucks),
                            loadTrailerAssignments(trailers),
                            loadTrailerAccreditation(normalizedRutMandante, normalizedDelegacion, trailers),
                            loadDriverKpiSummary(normalizedClientId, drivers),
                            loadTruckKpiSummary(normalizedClientId, trucks),
                            loadTrailerKpiSummary(normalizedClientId, trailers))
                            .asTuple()
                            .map(lookups -> toResourceSearchResponse(
                                    drivers,
                                    trucks,
                                    trailers,
                                    lookups.getItem1(),
                                    lookups.getItem2(),
                                    lookups.getItem3(),
                                    lookups.getItem4(),
                                    lookups.getItem5(),
                                    lookups.getItem6(),
                                    lookups.getItem7(),
                                    lookups.getItem8(),
                                    lookups.getItem9()));
                });
    }

    private Uni<List<Carrier>> loadActiveCarriers(String clientId) {
        return sessionFactory.withSession(session -> session
                .createQuery(ACTIVE_CARRIERS_QUERY, Carrier.class)
                .setParameter("clientId", clientId)
                .getResultList());
    }

    private Uni<Carrier> findActiveCarrier(String clientId, Long carrierId) {
        return sessionFactory.withSession(session -> session
                .createQuery(ACTIVE_CARRIER_BY_ID_QUERY, Carrier.class)
                .setParameter("clientId", clientId)
                .setParameter("carrierId", carrierId)
                .getSingleResultOrNull());
    }

    private Uni<Map<Long, CarrierDriverMetrics>> loadCarrierDriverMetrics(String clientId) {
        return sessionFactory.withSession(session -> session
                .createQuery(CARRIER_DRIVER_METRICS_QUERY, Object[].class)
                .setParameter("clientId", clientId)
                .getResultList())
                .map(rows -> {
                    Map<Long, CarrierDriverMetrics> metricsByCarrierId = new HashMap<>();

                    for (Object[] row : rows) {
                        Long carrierId = toLong(row[0]);
                        if (carrierId == null) {
                            continue;
                        }

                        metricsByCarrierId.put(carrierId, new CarrierDriverMetrics(
                                defaultLong(toLong(row[1])),
                                defaultLong(toLong(row[2])),
                                defaultLong(toLong(row[3])),
                                defaultLong(toLong(row[4]))));
                    }

                    return metricsByCarrierId;
                });
    }

    private Uni<List<Driver>> loadDriversByCarrier(String clientId, Long carrierId) {
        return sessionFactory.withSession(session -> session
                .createQuery(DRIVERS_BY_CARRIER_QUERY, Driver.class)
                .setParameter("clientId", clientId)
                .setParameter("carrierId", carrierId)
                .getResultList());
    }

    private Uni<List<TruckResourceRow>> loadTrucksByCarrier(String clientId, Long carrierId) {
        return resourceTableHasColumn(assignmentConfig.resource().fleetSchema(), "rd_trucks", "carrier_id")
                .flatMap(hasCarrierId -> {
                    if (!hasCarrierId) {
                        return Uni.createFrom().item(List.of());
                    }

                    return sessionFactory.withSession(session -> session
                            .createNativeQuery(trucksByCarrierSql(), Object[].class)
                            .setParameter("clientId", clientId)
                            .setParameter("carrierId", carrierId)
                            .getResultList())
                            .map(rows -> rows.stream()
                                    .map(this::toTruckResourceRow)
                                    .toList());
                });
    }

    private Uni<List<TrailerResourceRow>> loadTrailersByCarrier(String clientId, Long carrierId) {
        return resourceTableHasColumn(assignmentConfig.resource().fleetSchema(), "rd_trailers", "carrier_id")
                .flatMap(hasCarrierId -> {
                    if (!hasCarrierId) {
                        return Uni.createFrom().item(List.of());
                    }

                    return sessionFactory.withSession(session -> session
                            .createNativeQuery(trailersByCarrierSql(), Object[].class)
                            .setParameter("clientId", clientId)
                            .setParameter("carrierId", carrierId)
                            .getResultList())
                            .map(rows -> rows.stream()
                                    .map(this::toTrailerResourceRow)
                                    .toList());
                });
    }

    private Uni<Boolean> resourceTableHasColumn(String schema, String table, String column) {
        return sessionFactory.withSession(session -> session
                .createNativeQuery(resourceColumnExistsSql(), Long.class)
                .setParameter("schemaName", schema)
                .setParameter("tableName", table)
                .setParameter("columnName", column)
                .getSingleResultOrNull())
                .map(count -> count != null && count > 0);
    }

    private Uni<Map<String, AccreditationInfo>> loadDriverAccreditation(String rutMandante, String delegacion,
            List<Driver> drivers) {
        String[] normalizedRuts = drivers.stream()
                .map(driver -> normalizeAlphaNumeric(driver.rut))
                .filter(Objects::nonNull)
                .distinct()
                .toArray(String[]::new);

        if (normalizedRuts.length == 0) {
            return Uni.createFrom().item(Map.of());
        }

        PgPool coordinatorPool = assignmentReactivePools.coordinatorPool();
        return coordinatorPool.preparedQuery(driverAccreditationSql())
                .execute(Tuple.of(rutMandante, delegacion, normalizedRuts))
                .map(rows -> {
                    Map<String, AccreditationInfo> accreditationByRut = new HashMap<>();
                    for (Row row : rows) {
                        String resourceKey = row.getString("resource_key");
                        if (resourceKey == null) {
                            continue;
                        }
                        accreditationByRut.put(resourceKey, new AccreditationInfo(
                                Boolean.TRUE.equals(row.getBoolean("certified")),
                                row.getLocalDate("minimum_accreditation_date"),
                                defaultLong(row.getLong("record_count"))));
                    }
                    return accreditationByRut;
                });
    }

    private Uni<Map<String, AccreditationInfo>> loadTruckAccreditation(String rutMandante, String delegacion,
            List<TruckResourceRow> trucks) {
        String[] normalizedPlates = trucks.stream()
                .map(truck -> normalizeAlphaNumeric(truck.licensePlate()))
                .filter(Objects::nonNull)
                .distinct()
                .toArray(String[]::new);

        if (normalizedPlates.length == 0) {
            return Uni.createFrom().item(Map.of());
        }

        PgPool coordinatorPool = assignmentReactivePools.coordinatorPool();
        return coordinatorPool.preparedQuery(truckAccreditationSql())
                .execute(Tuple.of(rutMandante, delegacion, normalizedPlates))
                .map(rows -> {
                    Map<String, AccreditationInfo> accreditationByPlate = new HashMap<>();
                    for (Row row : rows) {
                        String resourceKey = row.getString("resource_key");
                        if (resourceKey == null) {
                            continue;
                        }
                        accreditationByPlate.put(resourceKey, new AccreditationInfo(
                                Boolean.TRUE.equals(row.getBoolean("certified")),
                                row.getLocalDate("minimum_accreditation_date"),
                                defaultLong(row.getLong("record_count"))));
                    }
                    return accreditationByPlate;
                });
    }

    private Uni<Map<String, AccreditationInfo>> loadTrailerAccreditation(String normalizedRutMandante,
            String normalizedDelegacion, List<TrailerResourceRow> trailers) {
        String[] normalizedPlates = trailers.stream()
                .map(trailer -> normalizeAlphaNumeric(trailer.licensePlate()))
                .filter(Objects::nonNull)
                .distinct()
                .toArray(String[]::new);

        if (normalizedPlates.length == 0) {
            return Uni.createFrom().item(Map.of());
        }

        PgPool coordinatorPool = assignmentReactivePools.coordinatorPool();
        return coordinatorPool.preparedQuery(trailerAccreditationSql())
                .execute(Tuple.of(normalizedRutMandante, normalizedDelegacion, normalizedPlates))
                .map(rows -> {
                    Map<String, AccreditationInfo> accreditationByPlate = new HashMap<>();
                    for (Row row : rows) {
                        String resourceKey = row.getString("resource_key");
                        if (resourceKey == null) {
                            continue;
                        }
                        accreditationByPlate.put(resourceKey, new AccreditationInfo(
                                Boolean.TRUE.equals(row.getBoolean("certified")),
                                row.getLocalDate("minimum_accreditation_date"),
                                defaultLong(row.getLong("record_count"))));
                    }
                    return accreditationByPlate;
                });
    }

    private Uni<Map<String, LiveTripAssignment>> loadDriverAssignments(List<Driver> drivers) {
        String[] normalizedRuts = drivers.stream()
                .map(driver -> normalizeAlphaNumeric(driver.rut))
                .filter(Objects::nonNull)
                .distinct()
                .toArray(String[]::new);

        if (normalizedRuts.length == 0) {
            return Uni.createFrom().item(Map.of());
        }

        PgPool streamHubPool = assignmentReactivePools.streamHubPool();
        return streamHubPool.preparedQuery(driverAssignmentsSql())
                .execute(Tuple.of((Object) normalizedRuts))
                .map(rows -> {
                    Map<String, LiveTripAssignment> assignmentsByRut = new HashMap<>();
                    for (Row row : rows) {
                        LiveTripAssignment assignment = toLiveTripAssignment(row);
                        putLatestAssignment(assignmentsByRut,
                                normalizeAlphaNumeric(row.getString("driver_id")),
                                assignment);
                        putLatestAssignment(assignmentsByRut,
                                normalizeAlphaNumeric(row.getString("second_driver_id")),
                                assignment);
                    }
                    return assignmentsByRut;
                });
    }

    private Uni<Map<String, LiveTripAssignment>> loadTruckAssignments(List<TruckResourceRow> trucks) {
        String[] rawIdentifiers = trucks.stream()
                .flatMap(truck -> Stream.of(cleanText(truck.externalId()), cleanText(truck.licensePlate())))
                .filter(Objects::nonNull)
                .distinct()
                .toArray(String[]::new);

        String[] normalizedIdentifiers = trucks.stream()
                .flatMap(truck -> Stream.of(
                        normalizeAlphaNumeric(truck.externalId()),
                        normalizeAlphaNumeric(truck.licensePlate())))
                .filter(Objects::nonNull)
                .distinct()
                .toArray(String[]::new);

        if (rawIdentifiers.length == 0 && normalizedIdentifiers.length == 0) {
            return Uni.createFrom().item(Map.of());
        }

        PgPool streamHubPool = assignmentReactivePools.streamHubPool();
        return streamHubPool.preparedQuery(truckAssignmentsSql())
                .execute(Tuple.of((Object) rawIdentifiers, (Object) normalizedIdentifiers))
                .map(rows -> {
                    Map<String, LiveTripAssignment> assignmentsByKey = new HashMap<>();
                    for (Row row : rows) {
                        LiveTripAssignment assignment = toLiveTripAssignment(row);
                        String assetId = row.getString("asset_id");
                        putLatestAssignment(assignmentsByKey, cleanText(assetId), assignment);
                        putLatestAssignment(assignmentsByKey, normalizeAlphaNumeric(assetId), assignment);
                    }
                    return assignmentsByKey;
                });
    }

    private Uni<Map<String, LiveTripAssignment>> loadTrailerAssignments(List<TrailerResourceRow> trailers) {
        String[] normalizedPlates = trailers.stream()
                .map(trailer -> normalizeAlphaNumeric(trailer.licensePlate()))
                .filter(Objects::nonNull)
                .distinct()
                .toArray(String[]::new);

        if (normalizedPlates.length == 0) {
            return Uni.createFrom().item(Map.of());
        }

        PgPool streamHubPool = assignmentReactivePools.streamHubPool();
        return streamHubPool.preparedQuery(trailerAssignmentsSql())
                .execute(Tuple.of((Object) normalizedPlates))
                .map(rows -> {
                    Map<String, LiveTripAssignment> assignmentsByPlate = new HashMap<>();
                    for (Row row : rows) {
                        LiveTripAssignment assignment = toLiveTripAssignment(row);
                        putLatestAssignment(assignmentsByPlate,
                                normalizeAlphaNumeric(row.getString("rampla_plate")),
                                assignment);
                    }
                    return assignmentsByPlate;
                });
    }

    private CarrierSearchResponse toCarrierSearchResponse(List<Carrier> carriers,
            Map<Long, CarrierDriverMetrics> metricsByCarrierId) {
        List<CarrierSearchResponse.CarrierCandidate> candidates = carriers.stream()
                .map(carrier -> toCarrierCandidate(
                        carrier,
                        metricsByCarrierId.getOrDefault(carrier.id, CarrierDriverMetrics.EMPTY)))
                .toList();

        return new CarrierSearchResponse(candidates);
    }

    private CarrierSearchResponse.CarrierCandidate toCarrierCandidate(Carrier carrier,
            CarrierDriverMetrics driverMetrics) {
        return new CarrierSearchResponse.CarrierCandidate(
                carrier.id,
                carrier.entityId,
                carrier.externalId,
                carrier.name,
                carrier.rut,
                carrier.status,
                carrier.active,
                buildCarrierCalculatedFields(carrier, driverMetrics));
    }

    private ResourceSearchResponse toResourceSearchResponse(
            List<Driver> drivers,
            List<TruckResourceRow> trucks,
            List<TrailerResourceRow> trailers,
            Map<String, AccreditationInfo> driverAccreditation,
            Map<String, AccreditationInfo> truckAccreditation,
            Map<String, LiveTripAssignment> driverAssignments,
            Map<String, LiveTripAssignment> truckAssignments,
            Map<String, LiveTripAssignment> trailerAssignments,
            Map<String, AccreditationInfo> trailerAccreditation,
            Map<String, KpisSummary> driverKpiSummary,
            Map<String, KpisSummary> truckKpiSummary,
            Map<String, KpisSummary> trailerKpiSummary) {

        List<ResourceSearchResponse.DriverCandidate> driverCandidates = drivers.stream()
                .map(driver -> toDriverCandidate(driver, driverAccreditation, driverAssignments, driverKpiSummary))
                .toList();

        List<ResourceSearchResponse.TruckCandidate> truckCandidates = trucks.stream()
                .map(truck -> toTruckCandidate(truck, truckAccreditation, truckAssignments, truckKpiSummary))
                .toList();

        List<ResourceSearchResponse.TrailerCandidate> trailerCandidates = trailers.stream()
                .map(trailer -> toTrailerCandidate(trailer, trailerAccreditation, trailerAssignments,
                        trailerKpiSummary))
                .toList();

        return new ResourceSearchResponse(driverCandidates, truckCandidates, trailerCandidates);
    }

    private ResourceSearchResponse.DriverCandidate toDriverCandidate(
            Driver driver,
            Map<String, AccreditationInfo> driverAccreditation,
            Map<String, LiveTripAssignment> driverAssignments,
            Map<String, KpisSummary> driverKpiSummary) {

        String normalizedRut = normalizeAlphaNumeric(driver.rut);
        AccreditationInfo accreditation = normalizedRut != null
                ? driverAccreditation.getOrDefault(normalizedRut, AccreditationInfo.EMPTY)
                : AccreditationInfo.EMPTY;
        LiveTripAssignment assignment = normalizedRut != null ? driverAssignments.get(normalizedRut) : null;
        KpisSummary kpiSummary = lookupDriverKpiSummary(driver, driverKpiSummary);

        return new ResourceSearchResponse.DriverCandidate(
                driver.id,
                driver.entityId,
                driver.externalId,
                fullName(driver.firstName, driver.lastName),
                driver.rut,
                driver.status,
                driver.active,
                accreditation.certified(),
                driver.active && assignment == null,
                buildDriverCalculatedFields(driver, accreditation, assignment, kpiSummary));
    }

    private ResourceSearchResponse.TruckCandidate toTruckCandidate(
            TruckResourceRow truck,
            Map<String, AccreditationInfo> truckAccreditation,
            Map<String, LiveTripAssignment> truckAssignments,
            Map<String, KpisSummary> truckKpiSummary) {

        String normalizedPlate = normalizeAlphaNumeric(truck.licensePlate());
        AccreditationInfo accreditation = normalizedPlate != null
                ? truckAccreditation.getOrDefault(normalizedPlate, AccreditationInfo.EMPTY)
                : AccreditationInfo.EMPTY;
        LiveTripAssignment assignment = lookupTruckAssignment(truck, truckAssignments);
        KpisSummary kpiSummary = lookupTruckKpiSummary(truck, truckKpiSummary);

        return new ResourceSearchResponse.TruckCandidate(
                truck.id(),
                truck.entityId(),
                truck.externalId(),
                truck.licensePlate(),
                truck.brand(),
                truck.model(),
                truck.truckType(),
                truck.status(),
                truck.active(),
                accreditation.certified(),
                truck.active() && assignment == null,
                buildTruckCalculatedFields(truck, accreditation, assignment, kpiSummary));
    }

    private ResourceSearchResponse.TrailerCandidate toTrailerCandidate(
            TrailerResourceRow trailer,
            Map<String, AccreditationInfo> trailerAccreditation,
            Map<String, LiveTripAssignment> trailerAssignments,
            Map<String, KpisSummary> trailerKpiSummary) {

        String normalizedPlate = normalizeAlphaNumeric(trailer.licensePlate());
        AccreditationInfo accreditation = normalizedPlate != null
                ? trailerAccreditation.getOrDefault(normalizedPlate, AccreditationInfo.EMPTY)
                : AccreditationInfo.EMPTY;
        LiveTripAssignment assignment = normalizedPlate != null ? trailerAssignments.get(normalizedPlate) : null;
        KpisSummary kpiSummary = lookupTrailerKpiSummary(trailer, trailerKpiSummary);

        return new ResourceSearchResponse.TrailerCandidate(
                trailer.id(),
                trailer.entityId(),
                trailer.externalId(),
                trailer.licensePlate(),
                trailer.trailerType(),
                trailer.status(),
                trailer.active(),
                accreditation.certified(),
                trailer.active() && assignment == null,
                buildTrailerCalculatedFields(trailer, accreditation, assignment, kpiSummary));
    }

    private Map<String, Object> buildCarrierCalculatedFields(Carrier carrier, CarrierDriverMetrics driverMetrics) {
        Instant now = Instant.now();
        LinkedHashMap<String, Object> calculatedFields = new LinkedHashMap<>();
        boolean hasTransportLicense = hasText(carrier.transportLicense);

        calculatedFields.put("driverCount", driverMetrics.driverCount());
        calculatedFields.put("activeDriverCount", driverMetrics.activeDriverCount());
        calculatedFields.put("blockedDriverCount", driverMetrics.blockedDriverCount());
        calculatedFields.put("occasionalDriverCount", driverMetrics.occasionalDriverCount());
        calculatedFields.put("hasTransportLicense", hasTransportLicense);

        if (hasTransportLicense) {
            calculatedFields.put("transportLicense", carrier.transportLicense);
        }

        if (carrier.transportLicenseExpires != null) {
            LocalDate today = LocalDate.now(ZoneOffset.UTC);
            LocalDate expiresOn = carrier.transportLicenseExpires.atZone(ZoneOffset.UTC).toLocalDate();

            calculatedFields.put("transportLicenseExpiresAt", carrier.transportLicenseExpires);
            calculatedFields.put("transportLicenseExpired", carrier.transportLicenseExpires.isBefore(now));
            calculatedFields.put("transportLicenseExpiresInDays", ChronoUnit.DAYS.between(today, expiresOn));
        } else {
            calculatedFields.put("transportLicenseExpired", false);
        }

        return calculatedFields;
    }

    private Map<String, Object> buildDriverCalculatedFields(Driver driver, AccreditationInfo accreditation,
            LiveTripAssignment assignment, KpisSummary driverKpiSummary) {
        LinkedHashMap<String, Object> calculatedFields = new LinkedHashMap<>();
        calculatedFields.put("carrierId", driver.carrierId);
        calculatedFields.put("licenseNumber", driver.licenseNumber);
        calculatedFields.put("licenseCategory", driver.licenseCategory);
        calculatedFields.put("licenseExpiresAt", driver.licenseExpires);
        calculatedFields.put("isOccasional", driver.isOccasional);
        calculatedFields.put("operationBlocked", driver.operationBlocked);
        calculatedFields.put("hasActiveAccreditationRecord", accreditation.recordCount() > 0);
        calculatedFields.put("minimumAccreditationDate", accreditation.minimumAccreditationDate());
        addLiveTripFields(calculatedFields, assignment);

        // Add driver KPI summary fields if available
        if (driverKpiSummary != null) {
            calculatedFields.put("previousTrips", driverKpiSummary.previousTrips);
            calculatedFields.put("lastTripId", driverKpiSummary.lastTripId);
            calculatedFields.put("lastTripStartTime", driverKpiSummary.lastTripStartTime);
            calculatedFields.put("lastTripEndTime", driverKpiSummary.lastTripEndTime);
            calculatedFields.put("traveledKilometers", driverKpiSummary.traveledKilometers);
            calculatedFields.put("speedLimitEvents", driverKpiSummary.speedLimitEvents);
            calculatedFields.put("continuousRestingEvents", driverKpiSummary.continuousRestingEvents);
        }
        return calculatedFields;
    }

    private Map<String, Object> buildTruckCalculatedFields(TruckResourceRow truck, AccreditationInfo accreditation,
            LiveTripAssignment assignment, KpisSummary truckKpiSummary) {
        LinkedHashMap<String, Object> calculatedFields = new LinkedHashMap<>();
        calculatedFields.put("carrierId", truck.carrierId());
        calculatedFields.put("vin", truck.vin());
        calculatedFields.put("year", truck.year());
        calculatedFields.put("maxWeight", truck.maxWeight());
        calculatedFields.put("volume", truck.volume());
        calculatedFields.put("hasActiveAccreditationRecord", accreditation.recordCount() > 0);
        calculatedFields.put("minimumAccreditationDate", accreditation.minimumAccreditationDate());
        addLiveTripFields(calculatedFields, assignment);

        // Add truck KPI summary fields if available
        if (truckKpiSummary != null) {
            calculatedFields.put("previousTrips", truckKpiSummary.previousTrips);
            calculatedFields.put("lastTripId", truckKpiSummary.lastTripId);
            calculatedFields.put("lastTripStartTime", truckKpiSummary.lastTripStartTime);
            calculatedFields.put("lastTripEndTime", truckKpiSummary.lastTripEndTime);
            calculatedFields.put("traveledKilometers", truckKpiSummary.traveledKilometers);
            calculatedFields.put("lostSignalEvents", truckKpiSummary.lostSignalEvents);
        }
        return calculatedFields;
    }

    private Map<String, Object> buildTrailerCalculatedFields(TrailerResourceRow trailer,
            AccreditationInfo accreditation,
            LiveTripAssignment assignment,
            KpisSummary trailerKpiSummary) {
        LinkedHashMap<String, Object> calculatedFields = new LinkedHashMap<>();
        calculatedFields.put("carrierId", trailer.carrierId());
        calculatedFields.put("maxWeight", trailer.maxWeight());
        calculatedFields.put("axleCount", trailer.axleCount());
        calculatedFields.put("hasActiveAccreditationRecord", accreditation.recordCount() > 0);
        calculatedFields.put("minimumAccreditationDate", accreditation.minimumAccreditationDate());
        addLiveTripFields(calculatedFields, assignment);

        // Add trailer KPI summary fields if available
        if (trailerKpiSummary != null) {
            calculatedFields.put("previousTrips", trailerKpiSummary.previousTrips);
            calculatedFields.put("lastTripId", trailerKpiSummary.lastTripId);
            calculatedFields.put("lastTripStartTime", trailerKpiSummary.lastTripStartTime);
            calculatedFields.put("lastTripEndTime", trailerKpiSummary.lastTripEndTime);
            calculatedFields.put("traveledKilometers", trailerKpiSummary.traveledKilometers);
        }
        return calculatedFields;
    }

    private static void addLiveTripFields(Map<String, Object> calculatedFields, LiveTripAssignment assignment) {
        if (assignment == null) {
            return;
        }

        calculatedFields.put("currentTripId", assignment.tripId());
        calculatedFields.put("currentTripStatus", assignment.status());
        calculatedFields.put("currentTripStartTime", assignment.startTime());
        calculatedFields.put("currentTripEndTime", assignment.endTime());
        calculatedFields.put("estimatedArrivalTime", assignment.estimatedArrivalTime());
    }

    // --- KPI summary loading from streamhub ---
    private Uni<Map<String, KpisSummary>> loadDriverKpiSummary(String clientId, List<Driver> drivers) {
        String[] rawDriverIds = drivers.stream()
                .map(driver -> cleanText(driver.rut))
                .filter(Objects::nonNull)
                .distinct()
                .toArray(String[]::new);

        if (rawDriverIds.length == 0) {
            return Uni.createFrom().item(Map.of());
        }

        PgPool streamHubPool = assignmentReactivePools.streamHubPool();
        return streamHubPool.preparedQuery(driverKpisSummarySql())
                .execute(Tuple.of(clientId, rawDriverIds))
                .map(rows -> {
                    Map<String, KpisSummary> summaryByDriver = new HashMap<>();
                    for (Row row : rows) {
                        KpisSummary kpi = new KpisSummary(
                                row.getLong("previous_trips"),
                                row.getString("last_trip_id"),
                                row.getOffsetDateTime("last_trip_start_time"),
                                row.getOffsetDateTime("last_trip_end_time"),
                                row.getBigDecimal("traveled_kilometers"),
                                row.getLong("speed_limit_events"),
                                row.getLong("continuous_resting_events"),
                                row.getLong("lost_signal_events"));
                        String driverId = row.getString("driver_id");
                        if (driverId == null) {
                            continue;
                        }
                        summaryByDriver.put(cleanText(driverId), kpi);
                    }
                    return summaryByDriver;
                });
    }

    private Uni<Map<String, KpisSummary>> loadTruckKpiSummary(String clientId, List<TruckResourceRow> trucks) {
        String[] rawIdentifiers = trucks.stream()
                .flatMap(truck -> Stream.of(cleanText(truck.externalId()), cleanText(truck.licensePlate())))
                .filter(Objects::nonNull)
                .distinct()
                .toArray(String[]::new);

        if (rawIdentifiers.length == 0) {
            return Uni.createFrom().item(Map.of());
        }

        PgPool streamHubPool = assignmentReactivePools.streamHubPool();
        return streamHubPool.preparedQuery(truckKpisSummarySql())
                .execute(Tuple.of(clientId, rawIdentifiers))
                .map(rows -> {
                    Map<String, KpisSummary> summaryByTruck = new HashMap<>();
                    for (Row row : rows) {
                        KpisSummary kpi = new KpisSummary(
                                row.getLong("previous_trips"),
                                row.getString("last_trip_id"),
                                row.getOffsetDateTime("last_trip_start_time"),
                                row.getOffsetDateTime("last_trip_end_time"),
                                row.getBigDecimal("traveled_kilometers"),
                                row.getLong("speed_limit_events"),
                                row.getLong("continuous_resting_events"),
                                row.getLong("lost_signal_events"));
                        String assetId = row.getString("asset_id");
                        if (assetId == null) {
                            continue;
                        }
                        summaryByTruck.put(cleanText(assetId), kpi);
                    }
                    return summaryByTruck;
                });
    }

    private Uni<Map<String, KpisSummary>> loadTrailerKpiSummary(String clientId,
            List<TrailerResourceRow> trailers) {
        String[] rawPlates = trailers.stream()
                .map(trailer -> cleanText(trailer.licensePlate()))
                .filter(Objects::nonNull)
                .distinct()
                .toArray(String[]::new);

        if (rawPlates.length == 0) {
            return Uni.createFrom().item(Map.of());
        }

        PgPool streamHubPool = assignmentReactivePools.streamHubPool();
        return streamHubPool.preparedQuery(trailerKpisSummarySql())
                .execute(Tuple.of(clientId, rawPlates))
                .map(rows -> {
                    Map<String, KpisSummary> summaryByTrailer = new HashMap<>();
                    for (Row row : rows) {
                        KpisSummary kpi = new KpisSummary(
                                row.getLong("previous_trips"),
                                row.getString("last_trip_id"),
                                row.getOffsetDateTime("last_trip_start_time"),
                                row.getOffsetDateTime("last_trip_end_time"),
                                row.getBigDecimal("traveled_kilometers"),
                                row.getLong("speed_limit_events"),
                                row.getLong("continuous_resting_events"),
                                row.getLong("lost_signal_events"));
                        String plate = row.getString("rampla_plate");
                        if (plate == null) {
                            continue;
                        }
                        summaryByTrailer.put(cleanText(plate), kpi);
                    }
                    return summaryByTrailer;
                });
    }

    private KpisSummary lookupDriverKpiSummary(Driver driver,
            Map<String, KpisSummary> driverKpiSummary) {
        for (String key : new String[] {
                cleanText(driver.rut),
                normalizeAlphaNumeric(driver.rut) }) {
            if (key == null) {
                continue;
            }

            KpisSummary summary = driverKpiSummary.get(key);
            if (summary != null) {
                return summary;
            }
        }

        return null;
    }

    private LiveTripAssignment lookupTruckAssignment(TruckResourceRow truck,
            Map<String, LiveTripAssignment> truckAssignments) {
        for (String key : new String[] {
                cleanText(truck.externalId()),
                normalizeAlphaNumeric(truck.externalId()),
                cleanText(truck.licensePlate()),
                normalizeAlphaNumeric(truck.licensePlate()) }) {
            if (key == null) {
                continue;
            }

            LiveTripAssignment assignment = truckAssignments.get(key);
            if (assignment != null) {
                return assignment;
            }
        }

        return null;
    }

    private KpisSummary lookupTruckKpiSummary(TruckResourceRow truck,
            Map<String, KpisSummary> truckKpiSummary) {
        for (String key : new String[] {
                cleanText(truck.externalId()),
                normalizeAlphaNumeric(truck.externalId()),
                cleanText(truck.licensePlate()),
                normalizeAlphaNumeric(truck.licensePlate()) }) {
            if (key == null) {
                continue;
            }

            KpisSummary summary = truckKpiSummary.get(key);
            if (summary != null) {
                return summary;
            }
        }

        return null;
    }

    private KpisSummary lookupTrailerKpiSummary(TrailerResourceRow trailer,
            Map<String, KpisSummary> trailerKpiSummary) {
        for (String key : new String[] {
                cleanText(trailer.licensePlate()),
                normalizeAlphaNumeric(trailer.licensePlate()) }) {
            if (key == null) {
                continue;
            }

            KpisSummary summary = trailerKpiSummary.get(key);
            if (summary != null) {
                return summary;
            }
        }

        return null;
    }

    private TruckResourceRow toTruckResourceRow(Object[] row) {
        return new TruckResourceRow(
                toLong(row[0]),
                toUuid(row[1]),
                toStringValue(row[2]),
                toStringValue(row[3]),
                toStringValue(row[4]),
                toStringValue(row[5]),
                toStringValue(row[6]),
                toInteger(row[7]),
                toBigDecimal(row[8]),
                toBigDecimal(row[9]),
                toStringValue(row[10]),
                toStringValue(row[11]),
                toBoolean(row[12]),
                toLong(row[13]));
    }

    private TrailerResourceRow toTrailerResourceRow(Object[] row) {
        return new TrailerResourceRow(
                toLong(row[0]),
                toUuid(row[1]),
                toStringValue(row[2]),
                toStringValue(row[3]),
                toStringValue(row[4]),
                toBigDecimal(row[5]),
                toInteger(row[6]),
                toStringValue(row[7]),
                toBoolean(row[8]),
                toLong(row[9]));
    }

    private LiveTripAssignment toLiveTripAssignment(Row row) {
        return new LiveTripAssignment(
                row.getString("trip_id"),
                row.getString("status"),
                row.getOffsetDateTime("start_time"),
                row.getOffsetDateTime("end_time"),
                row.getOffsetDateTime("estimated_arrival_time"));
    }

    private static void putLatestAssignment(Map<String, LiveTripAssignment> assignmentsByKey,
            String key, LiveTripAssignment candidate) {
        if (key == null || candidate == null) {
            return;
        }

        assignmentsByKey.merge(key, candidate, TripResourceAssignmentService::latestAssignment);
    }

    private static LiveTripAssignment latestAssignment(LiveTripAssignment current, LiveTripAssignment incoming) {
        return assignmentTimestamp(incoming).isAfter(assignmentTimestamp(current)) ? incoming : current;
    }

    private static OffsetDateTime assignmentTimestamp(LiveTripAssignment assignment) {
        if (assignment == null) {
            return OffsetDateTime.MIN;
        }
        if (assignment.estimatedArrivalTime() != null) {
            return assignment.estimatedArrivalTime();
        }
        if (assignment.startTime() != null) {
            return assignment.startTime();
        }
        if (assignment.endTime() != null) {
            return assignment.endTime();
        }
        return OffsetDateTime.MIN;
    }

    private void ensureExternalLookupsEnabled() {
        if (!assignmentConfig.coordinator().enabled()) {
            throw serviceUnavailable("Coordinator datasource is not enabled");
        }
        if (!assignmentConfig.streamhub().enabled()) {
            throw serviceUnavailable("StreamHub datasource is not enabled");
        }
    }

    private static void validateCarrierSearchRequest(String clientId, CarrierSearchRequest request) {
        if (!hasText(clientId)) {
            throw new WebApplicationException("Client context is required", Response.Status.UNAUTHORIZED);
        }
        if (request == null) {
            throw badRequest("Request body is required");
        }
        validateRequiredText(request.delegacion(), "delegacion");
        validateRequiredText(request.rutMandante(), "rutMandante");
    }

    private static void validateResourceSearchRequest(String clientId, ResourceSearchRequest request) {
        if (!hasText(clientId)) {
            throw new WebApplicationException("Client context is required", Response.Status.UNAUTHORIZED);
        }
        if (request == null) {
            throw badRequest("Request body is required");
        }
        if (request.carrierId() == null) {
            throw badRequest("carrierId is required");
        }
        validateRequiredText(request.delegacion(), "delegacion");
        validateRequiredText(request.rutMandante(), "rutMandante");
    }

    private static void validateRequiredText(String value, String fieldName) {
        if (!hasText(value)) {
            throw badRequest(fieldName + " is required");
        }
    }

    private static WebApplicationException badRequest(String message) {
        return new WebApplicationException(message, Response.Status.BAD_REQUEST);
    }

    private static WebApplicationException serviceUnavailable(String message) {
        return new WebApplicationException(message, Response.Status.SERVICE_UNAVAILABLE);
    }

    private String resourceColumnExistsSql() {
        return """
                select count(*)
                from information_schema.columns
                where table_schema = :schemaName
                  and table_name = :tableName
                  and column_name = :columnName
                """;
    }

    private String trucksByCarrierSql() {
        return """
                select id,
                       entity_id,
                       external_id,
                       license_plate,
                       vin,
                       brand,
                       model,
                       year,
                       max_weight,
                       volume,
                       truck_type,
                       status,
                       active,
                       carrier_id
                from %s.rd_trucks
                where client_id = :clientId
                  and active = true
                  and carrier_id = :carrierId
                order by license_plate, id
                """.formatted(assignmentConfig.resource().fleetSchema());
    }

    private String trailersByCarrierSql() {
        return """
                select id,
                       entity_id,
                       external_id,
                       license_plate,
                       trailer_type,
                       max_weight,
                       axle_count,
                       status,
                       active,
                       carrier_id
                from %s.rd_trailers
                where client_id = :clientId
                  and active = true
                  and carrier_id = :carrierId
                order by license_plate, id
                """.formatted(assignmentConfig.resource().fleetSchema());
    }

    private String driverAccreditationSql() {
        return """
                select upper(regexp_replace(rut, '[^0-9A-Za-z]', '', 'g')) as resource_key,
                       bool_or(acreditar = 'A') as certified,
                       min(fecha_minima_acreditacion) filter (where acreditar = 'A') as minimum_accreditation_date,
                       count(*) as record_count
                from %s.acreditacion_recursos
                where tipo_recurso = 'persona'
                  and cargo ILIKE '%%conductor%%'
                  and is_active = true
                  and upper(regexp_replace(rut_mandante, '[^0-9A-Za-z]', '', 'g')) = $1
                  and upper(trim(delegacion)) = $2
                  and upper(regexp_replace(coalesce(rut, ''), '[^0-9A-Za-z]', '', 'g')) = any($3)
                group by upper(regexp_replace(rut, '[^0-9A-Za-z]', '', 'g'))
                """.formatted(assignmentConfig.coordinator().schema());
    }

    private String truckAccreditationSql() {
        return """
                select upper(regexp_replace(patente, '[^0-9A-Za-z]', '', 'g')) as resource_key,
                       bool_or(acreditar = 'A') as certified,
                       min(fecha_minima_acreditacion) filter (where acreditar = 'A') as minimum_accreditation_date,
                       count(*) as record_count
                from %s.acreditacion_recursos
                where tipo_recurso = 'vehiculo'
                  and is_active = true
                  and upper(regexp_replace(rut_mandante, '[^0-9A-Za-z]', '', 'g')) = $1
                  and upper(trim(delegacion)) = $2
                  and upper(regexp_replace(coalesce(patente, ''), '[^0-9A-Za-z]', '', 'g')) = any($3)
                group by upper(regexp_replace(patente, '[^0-9A-Za-z]', '', 'g'))
                """.formatted(assignmentConfig.coordinator().schema());
    }

    private String trailerAccreditationSql() {
        return """
                select upper(regexp_replace(patente, '[^0-9A-Za-z]', '', 'g')) as resource_key,
                       bool_or(acreditar = 'A') as certified,
                       min(fecha_minima_acreditacion) filter (where acreditar = 'A') as minimum_accreditation_date,
                       count(*) as record_count
                from %s.acreditacion_recursos
                where tipo_recurso = 'vehiculo'
                  and is_active = true
                  and upper(regexp_replace(rut_mandante, '[^0-9A-Za-z]', '', 'g')) = $1
                  and upper(trim(delegacion)) = $2
                  and upper(regexp_replace(coalesce(patente, ''), '[^0-9A-Za-z]', '', 'g')) = any($3)
                group by upper(regexp_replace(patente, '[^0-9A-Za-z]', '', 'g'))
                """.formatted(assignmentConfig.coordinator().schema());
    }

    private String driverAssignmentsSql() {
        return """
                select trip_id,
                       status,
                       driver_id,
                       second_driver_id,
                       start_time,
                       end_time,
                       estimated_arrival_time
                from %s.live_trip
                where (end_time is null or coalesce(lower(status), '') not in ('completed', 'cancelled', 'finished'))
                  and (
                    upper(regexp_replace(coalesce(driver_id, ''), '[^0-9A-Za-z]', '', 'g')) = any($1)
                    or upper(regexp_replace(coalesce(second_driver_id, ''), '[^0-9A-Za-z]', '', 'g')) = any($1)
                  )
                order by start_time desc nulls last, estimated_arrival_time desc nulls last, trip_id
                """
                .formatted(assignmentConfig.streamhub().schema());
    }

    private String truckAssignmentsSql() {
        return """
                select trip_id,
                       status,
                       asset_id,
                       start_time,
                       end_time,
                       estimated_arrival_time
                from %s.live_trip
                where (end_time is null or coalesce(lower(status), '') not in ('completed', 'cancelled', 'finished'))
                  and (
                    coalesce(asset_id, '') = any($1)
                    or upper(regexp_replace(coalesce(asset_id, ''), '[^0-9A-Za-z]', '', 'g')) = any($2)
                  )
                order by start_time desc nulls last, estimated_arrival_time desc nulls last, trip_id
                """.formatted(assignmentConfig.streamhub().schema());
    }

    private String trailerAssignmentsSql() {
        return """
                select trip_id,
                       status,
                       rampla_plate,
                       start_time,
                       end_time,
                       estimated_arrival_time
                from %s.live_trip
                where (end_time is null or coalesce(lower(status), '') not in ('completed', 'cancelled', 'finished'))
                  and upper(regexp_replace(coalesce(rampla_plate, ''), '[^0-9A-Za-z]', '', 'g')) = any($1)
                order by start_time desc nulls last, estimated_arrival_time desc nulls last, trip_id
                """
                .formatted(assignmentConfig.streamhub().schema());
    }

    private String driverKpisSummarySql() {
        return """
                select driver_id,
                       previous_trips,
                       last_trip_id,
                       last_trip_start_time,
                       last_trip_end_time,
                       traveled_kilometers,
                       speed_limit_events,
                       continuous_resting_events,
                       null::bigint as lost_signal_events
                from %s.driver_kpi_summary
                where client_id = $1
                  and coalesce(driver_id, '') = any($2)
                """.formatted(assignmentConfig.streamhub().schema());
    }

    private String truckKpisSummarySql() {
        return """
                select asset_id,
                       previous_trips,
                       last_trip_id,
                       last_trip_start_time,
                       last_trip_end_time,
                       traveled_kilometers,
                       null::bigint as speed_limit_events,
                       null::bigint as continuous_resting_events,
                       lost_signal_events
                from %s.truck_kpi_summary
                where client_id = $1
                  and coalesce(asset_id, '') = any($2)
                """.formatted(assignmentConfig.streamhub().schema());
    }

    private String trailerKpisSummarySql() {
        return """
                select rampla_plate,
                       previous_trips,
                       last_trip_id,
                       last_trip_start_time,
                       last_trip_end_time,
                       traveled_kilometers,
                       null::bigint as speed_limit_events,
                       null::bigint as continuous_resting_events,
                       null::bigint as lost_signal_events
                from %s.trailer_kpi_summary
                where client_id = $1
                  and coalesce(rampla_plate, '') = any($2)
                """.formatted(assignmentConfig.streamhub().schema());
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String normalizeUpper(String value) {
        String cleaned = cleanText(value);
        return cleaned != null ? cleaned.toUpperCase() : null;
    }

    private static String normalizeAlphaNumeric(String value) {
        String cleaned = cleanText(value);
        if (cleaned == null) {
            return null;
        }

        String normalized = cleaned.replaceAll("[^0-9A-Za-z]", "").toUpperCase();
        return normalized.isEmpty() ? null : normalized;
    }

    private static String cleanText(String value) {
        if (!hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private static String fullName(String firstName, String lastName) {
        return Stream.of(firstName, lastName)
                .filter(TripResourceAssignmentService::hasText)
                .map(String::trim)
                .reduce((left, right) -> left + " " + right)
                .orElse("");
    }

    private static Long toLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value != null) {
            return Long.parseLong(value.toString());
        }
        return null;
    }

    private static Integer toInteger(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value != null) {
            return Integer.parseInt(value.toString());
        }
        return null;
    }

    private static UUID toUuid(Object value) {
        if (value instanceof UUID uuid) {
            return uuid;
        }
        if (value != null) {
            return UUID.fromString(value.toString());
        }
        return null;
    }

    private static BigDecimal toBigDecimal(Object value) {
        if (value instanceof BigDecimal bigDecimal) {
            return bigDecimal;
        }
        if (value instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        if (value != null) {
            return new BigDecimal(value.toString());
        }
        return null;
    }

    private static boolean toBoolean(Object value) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        return value != null && Boolean.parseBoolean(value.toString());
    }

    private static String toStringValue(Object value) {
        return value != null ? value.toString() : null;
    }

    private static long defaultLong(Long value) {
        return value != null ? value : 0L;
    }

    private static <T> Uni<T> notImplemented(String feature) {
        return Uni.createFrom().failure(
                new WebApplicationException(feature + " is not implemented yet", Response.Status.NOT_IMPLEMENTED));
    }

    private record CarrierDriverMetrics(
            long driverCount,
            long activeDriverCount,
            long blockedDriverCount,
            long occasionalDriverCount) {
        private static final CarrierDriverMetrics EMPTY = new CarrierDriverMetrics(0L, 0L, 0L, 0L);
    }

    private record AccreditationInfo(
            boolean certified,
            LocalDate minimumAccreditationDate,
            long recordCount) {
        private static final AccreditationInfo EMPTY = new AccreditationInfo(false, null, 0L);
    }

    private record LiveTripAssignment(
            String tripId,
            String status,
            OffsetDateTime startTime,
            OffsetDateTime endTime,
            OffsetDateTime estimatedArrivalTime) {
    }

    private record TruckResourceRow(
            Long id,
            UUID entityId,
            String externalId,
            String licensePlate,
            String vin,
            String brand,
            String model,
            Integer year,
            BigDecimal maxWeight,
            BigDecimal volume,
            String truckType,
            String status,
            boolean active,
            Long carrierId) {
    }

    private record TrailerResourceRow(
            Long id,
            UUID entityId,
            String externalId,
            String licensePlate,
            String trailerType,
            BigDecimal maxWeight,
            Integer axleCount,
            String status,
            boolean active,
            Long carrierId) {
    }

    private record KpisSummary(
            Long previousTrips,
            String lastTripId,
            OffsetDateTime lastTripStartTime,
            OffsetDateTime lastTripEndTime,
            BigDecimal traveledKilometers,
            Long speedLimitEvents,
            Long continuousRestingEvents,
            Long lostSignalEvents) {

    }
}
