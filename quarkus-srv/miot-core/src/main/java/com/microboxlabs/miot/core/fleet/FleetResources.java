package com.microboxlabs.miot.core.fleet;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * The fleet's carriers, trucks, trailers and drivers, for modules that reference them by id. Implemented by the
 * fleet module. Reads take no row locks.
 */
public interface FleetResources {

    /** A truck or trailer. */
    record Vehicle(String licensePlate, UUID carrierId) {
    }

    /** {@code phone} is the mobile phone when there is one. */
    record Driver(String rut, String fullName, String phone) {
    }

    record Carrier(UUID id, String legalName, String phone, String rut) {

        public Carrier(UUID id, String legalName, String phone) {
            this(id, legalName, phone, null);
        }
    }

    /**
     * A driver's current row with its carrier. {@code phone} is the mobile phone when there is one; {@code active} is
     * false when the driver is deleted or switched off.
     */
    record DriverDetails(UUID id, String document, String fullName, String phone, boolean active,
            String carrierLegalName, String carrierTaxId, OffsetDateTime updatedAt) {
    }

    /** A resource found by its natural key; {@code active} is false when it is switched off. */
    record Match(UUID id, boolean active) {
    }

    /** Whether {@code resourceType} (truck, trailer, driver) {@code id} exists for the tenant and is not inactive. */
    boolean exists(String tenantCode, String resourceType, UUID id);

    /** Whether {@code resourceType} (truck, trailer, driver) {@code id} is a current row, active or not. */
    default boolean known(String tenantCode, String resourceType, UUID id) {
        return exists(tenantCode, resourceType, id);
    }

    /** {@code resourceType} is truck or trailer. */
    Optional<Vehicle> vehicle(String tenantCode, String resourceType, UUID id);

    Optional<Driver> driver(String tenantCode, UUID id);

    Optional<Carrier> carrier(String tenantCode, UUID id);

    /**
     * The current truck or trailer ({@code resourceType}) whose plate matches {@code plate} ignoring case, spaces and
     * dashes; an active one first.
     */
    Optional<Match> byPlate(String tenantCode, String resourceType, String plate);

    /** The current driver whose document (RUT, DNI) matches {@code document} ignoring dots, dashes and spaces. */
    Optional<Match> driverByDocument(String tenantCode, String document);

    /** The tenant's active carriers whose RUT or legal name contains {@code query}, by legal name; at most {@code limit}. */
    default List<Carrier> carriers(String tenantCode, String query, int limit) {
        return List.of();
    }

    /** The current carrier whose tax id (RUT, RUC) matches {@code taxId} ignoring dots, dashes and spaces. */
    default Optional<Match> carrierByTaxId(String tenantCode, String taxId) {
        return Optional.empty();
    }

    /**
     * Registers a missing carrier or reuses its current normalized tax id, refusing an inactive match. Joins the
     * caller's transaction. {@code legalName} null takes the tax id; existing details are not overwritten.
     */
    default UUID registerCarrier(String tenantCode, String actor, String taxId, String legalName) {
        throw new UnsupportedOperationException("fleet is not enabled");
    }

    /** Registers or reuses a truck/trailer by normalized plate; a new one belongs to {@code carrierId}. */
    default UUID registerVehicle(String tenantCode, String actor, String resourceType, String plate,
            UUID carrierId) {
        throw new UnsupportedOperationException("fleet is not enabled");
    }

    /** Registers or reuses a driver by document; name, phone and carrier may be null and existing details stay intact. */
    default UUID registerDriver(String tenantCode, String actor, String document, String fullName,
            String mobilePhone, UUID carrierId) {
        throw new UnsupportedOperationException("fleet is not enabled");
    }

    /** Whether the fleet module is in the build; without it the driver reads below find nothing. */
    default boolean listsDrivers() {
        return false;
    }

    /** The tenant's current drivers among {@code ids}, active or not. */
    default List<DriverDetails> drivers(String tenantCode, Collection<UUID> ids) {
        return List.of();
    }

    /**
     * The tenant's current drivers whose row changed after {@code since}, ordered by {@code updatedAt} and id; at most
     * {@code limit}. {@code afterId} null starts at {@code since}; otherwise the page starts after the driver
     * ({@code since}, {@code afterId}), the last one of the previous page.
     */
    default List<DriverDetails> driversChangedSince(String tenantCode, OffsetDateTime since, UUID afterId,
            int limit) {
        return List.of();
    }
}
