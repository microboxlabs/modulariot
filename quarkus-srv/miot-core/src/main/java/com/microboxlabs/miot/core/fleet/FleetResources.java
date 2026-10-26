package com.microboxlabs.miot.core.fleet;

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

    /** A resource found by its natural key; {@code active} is false when it is switched off. */
    record Match(UUID id, boolean active) {
    }

    /** Whether {@code resourceType} (truck, trailer, driver) {@code id} exists for the tenant and is not inactive. */
    boolean exists(String tenantCode, String resourceType, UUID id);

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
     * Registers a carrier and returns its id. Joins the caller's transaction. {@code legalName} null takes the tax id.
     */
    default UUID registerCarrier(String tenantCode, String actor, String taxId, String legalName) {
        throw new UnsupportedOperationException("fleet is not enabled");
    }

    /** Registers a truck or trailer ({@code resourceType}) of {@code carrierId} and returns its id. */
    default UUID registerVehicle(String tenantCode, String actor, String resourceType, String plate,
            UUID carrierId) {
        throw new UnsupportedOperationException("fleet is not enabled");
    }

    /** Registers a driver and returns its id; {@code fullName}, {@code mobilePhone} and {@code carrierId} may be null. */
    default UUID registerDriver(String tenantCode, String actor, String document, String fullName,
            String mobilePhone, UUID carrierId) {
        throw new UnsupportedOperationException("fleet is not enabled");
    }
}
