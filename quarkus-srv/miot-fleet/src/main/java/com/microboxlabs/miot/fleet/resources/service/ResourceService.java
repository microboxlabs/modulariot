package com.microboxlabs.miot.fleet.resources.service;

import com.microboxlabs.miot.fleet.resources.domain.Carrier;
import com.microboxlabs.miot.fleet.resources.domain.Driver;
import com.microboxlabs.miot.fleet.resources.domain.Trailer;
import com.microboxlabs.miot.fleet.resources.domain.Truck;
import com.microboxlabs.miot.fleet.resources.dto.CarrierRequest;
import com.microboxlabs.miot.fleet.resources.dto.DriverRequest;
import com.microboxlabs.miot.fleet.resources.dto.TrailerRequest;
import com.microboxlabs.miot.fleet.resources.dto.TruckRequest;
import com.microboxlabs.miot.fleet.resources.store.ResourceStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

/** The resource directory: no deletes — resources deactivate by status. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.fleet.enabled", stringValue = "true")
public class ResourceService {

    public static final int MAX_PAGE_SIZE = 200;

    private final ResourceStore store;

    @Inject
    public ResourceService(ResourceStore store) {
        this.store = store;
    }

    // ---- carriers -------------------------------------------------------

    public List<Carrier> listCarriers(String tenantCode, String q, Integer page, Integer size) {
        return store.listCarriers(tenantCode, Check.blankToNull(q), page(page), size(size));
    }

    public Carrier createCarrier(String tenantCode, String actor, CarrierRequest body) {
        CarrierRequest req = body == null ? CarrierRequest.empty() : body;
        Carrier created = store.insertCarrier(new Carrier(null, tenantCode,
                Check.limitedOrNull(req.externalId(), "externalId", 128),
                Check.limitedOrNull(req.rut(), "rut", 32),
                Check.required(req.legalName(), "legalName", 255),
                Check.limitedOrNull(req.transportLicense(), "transportLicense", 64),
                req.transportLicenseExpires(),
                Check.limitedOrNull(req.contactName(), "contactName", 255),
                Check.limitedOrNull(req.phone(), "phone", 64),
                Check.limitedOrNull(req.email(), "email", 255),
                req.status() == null || req.status().isBlank() ? Carrier.ACTIVE
                        : Check.limited(req.status(), "status", 32),
                Boolean.TRUE.equals(req.isOccasional()),
                Check.limitedOrNull(req.sourceSystem(), "sourceSystem", 64), null,
                null, actor, null, actor));
        return created;
    }

    public Carrier updateCarrier(String tenantCode, String actor, UUID id, CarrierRequest body) {
        CarrierRequest req = body == null ? CarrierRequest.empty() : body;
        Carrier c = store.findCarrier(tenantCode, id)
                .orElseThrow(() -> new NoSuchElementException("carrier not found"));
        Carrier updated = store.updateCarrier(new Carrier(c.id(), tenantCode,
                Check.orKeep(req.externalId(), c.externalId(), "externalId", 128),
                Check.orKeep(req.rut(), c.rut(), "rut", 32),
                req.legalName() == null ? c.legalName() : Check.required(req.legalName(), "legalName", 255),
                Check.orKeep(req.transportLicense(), c.transportLicense(), "transportLicense", 64),
                req.transportLicenseExpires() == null ? c.transportLicenseExpires() : req.transportLicenseExpires(),
                Check.orKeep(req.contactName(), c.contactName(), "contactName", 255),
                Check.orKeep(req.phone(), c.phone(), "phone", 64),
                Check.orKeep(req.email(), c.email(), "email", 255),
                req.status() == null ? c.status() : Check.required(req.status(), "status", 32),
                req.isOccasional() == null ? c.isOccasional() : req.isOccasional(),
                c.sourceSystem(), c.sourceData(), c.createdAt(), c.createdBy(), null, actor))
                .orElseThrow(() -> new NoSuchElementException("carrier not found"));
        return updated;
    }

    // ---- trucks ---------------------------------------------------------

    public List<Truck> listTrucks(String tenantCode, String plate, String carrierId, Integer page, Integer size) {
        UUID cid = carrierId == null || carrierId.isBlank() ? null : parse(carrierId, "carrierId");
        return store.listTrucks(tenantCode, Check.blankToNull(plate), cid, page(page), size(size));
    }

    public Truck createTruck(String tenantCode, String actor, TruckRequest body) {
        TruckRequest req = body == null ? TruckRequest.empty() : body;
        String carrierId = Check.required(req.carrierId(), "carrierId", 64);
        parse(carrierId, "carrierId");
        Truck created = store.insertTruck(new Truck(null, tenantCode, carrierId,
                Check.limitedOrNull(req.externalId(), "externalId", 128),
                Check.required(req.licensePlate(), "licensePlate", 16),
                Check.limitedOrNull(req.vin(), "vin", 32),
                Check.limitedOrNull(req.truckType(), "truckType", 64),
                req.maxWeight(), req.volume(),
                req.status() == null || req.status().isBlank() ? Carrier.ACTIVE
                        : Check.limited(req.status(), "status", 32),
                Boolean.TRUE.equals(req.isOccasional()),
                Check.limitedOrNull(req.sourceSystem(), "sourceSystem", 64), null,
                null, actor, null, actor));
        return created;
    }

    public Truck updateTruck(String tenantCode, String actor, UUID id, TruckRequest body) {
        TruckRequest req = body == null ? TruckRequest.empty() : body;
        Truck t = store.findTruck(tenantCode, id)
                .orElseThrow(() -> new NoSuchElementException("truck not found"));
        Truck updated = store.updateTruck(new Truck(t.id(), tenantCode,
                req.carrierId() == null ? t.carrierId() : carrierId(req.carrierId()),
                Check.orKeep(req.externalId(), t.externalId(), "externalId", 128),
                req.licensePlate() == null ? t.licensePlate()
                        : Check.required(req.licensePlate(), "licensePlate", 16),
                Check.orKeep(req.vin(), t.vin(), "vin", 32),
                Check.orKeep(req.truckType(), t.truckType(), "truckType", 64),
                req.maxWeight() == null ? t.maxWeight() : req.maxWeight(),
                req.volume() == null ? t.volume() : req.volume(),
                req.status() == null ? t.status() : Check.required(req.status(), "status", 32),
                req.isOccasional() == null ? t.isOccasional() : req.isOccasional(),
                t.sourceSystem(), t.sourceData(), t.createdAt(), t.createdBy(), null, actor))
                .orElseThrow(() -> new NoSuchElementException("truck not found"));
        return updated;
    }

    // ---- trailers -------------------------------------------------------

    public List<Trailer> listTrailers(String tenantCode, String plate, Integer page, Integer size) {
        return store.listTrailers(tenantCode, Check.blankToNull(plate), page(page), size(size));
    }

    public Trailer createTrailer(String tenantCode, String actor, TrailerRequest body) {
        TrailerRequest req = body == null ? TrailerRequest.empty() : body;
        String carrierId = Check.required(req.carrierId(), "carrierId", 64);
        parse(carrierId, "carrierId");
        Trailer created = store.insertTrailer(new Trailer(null, tenantCode, carrierId,
                Check.limitedOrNull(req.externalId(), "externalId", 128),
                Check.required(req.licensePlate(), "licensePlate", 16),
                Check.limitedOrNull(req.vin(), "vin", 32),
                Check.limitedOrNull(req.trailerType(), "trailerType", 64),
                req.maxWeight(),
                req.status() == null || req.status().isBlank() ? Carrier.ACTIVE
                        : Check.limited(req.status(), "status", 32),
                Boolean.TRUE.equals(req.isOccasional()),
                Check.limitedOrNull(req.sourceSystem(), "sourceSystem", 64), null,
                null, actor, null, actor));
        return created;
    }

    public Trailer updateTrailer(String tenantCode, String actor, UUID id, TrailerRequest body) {
        TrailerRequest req = body == null ? TrailerRequest.empty() : body;
        Trailer t = store.findTrailer(tenantCode, id)
                .orElseThrow(() -> new NoSuchElementException("trailer not found"));
        Trailer updated = store.updateTrailer(new Trailer(t.id(), tenantCode,
                req.carrierId() == null ? t.carrierId() : carrierId(req.carrierId()),
                Check.orKeep(req.externalId(), t.externalId(), "externalId", 128),
                req.licensePlate() == null ? t.licensePlate()
                        : Check.required(req.licensePlate(), "licensePlate", 16),
                Check.orKeep(req.vin(), t.vin(), "vin", 32),
                Check.orKeep(req.trailerType(), t.trailerType(), "trailerType", 64),
                req.maxWeight() == null ? t.maxWeight() : req.maxWeight(),
                req.status() == null ? t.status() : Check.required(req.status(), "status", 32),
                req.isOccasional() == null ? t.isOccasional() : req.isOccasional(),
                t.sourceSystem(), t.sourceData(), t.createdAt(), t.createdBy(), null, actor))
                .orElseThrow(() -> new NoSuchElementException("trailer not found"));
        return updated;
    }

    // ---- drivers --------------------------------------------------------

    public List<Driver> listDrivers(String tenantCode, String rut, String q, Integer page, Integer size) {
        return store.listDrivers(tenantCode, Check.blankToNull(rut), Check.blankToNull(q), page(page), size(size));
    }

    public Driver createDriver(String tenantCode, String actor, DriverRequest body) {
        DriverRequest req = body == null ? DriverRequest.empty() : body;
        if (req.carrierId() != null && !req.carrierId().isBlank()) {
            parse(req.carrierId(), "carrierId");
        }
        String fullName = req.fullName() != null && !req.fullName().isBlank() ? req.fullName().trim()
                : join(req.firstName(), req.lastName());
        Driver created = store.insertDriver(new Driver(null, tenantCode,
                Check.blankToNull(req.carrierId()),
                Check.limitedOrNull(req.externalId(), "externalId", 128),
                Check.required(req.rut(), "rut", 32),
                Check.limitedOrNull(req.firstName(), "firstName", 128),
                Check.limitedOrNull(req.lastName(), "lastName", 128),
                Check.limitedOrNull(fullName, "fullName", 255),
                Check.limitedOrNull(req.phone(), "phone", 64),
                Check.limitedOrNull(req.mobilePhone(), "mobilePhone", 64),
                Check.limitedOrNull(req.licenseCategory(), "licenseCategory", 16),
                req.licenseExpires(),
                req.status() == null || req.status().isBlank() ? Carrier.ACTIVE
                        : Check.limited(req.status(), "status", 32),
                Boolean.TRUE.equals(req.isOccasional()),
                Check.limitedOrNull(req.sourceSystem(), "sourceSystem", 64), null,
                null, actor, null, actor));
        return created;
    }

    public Driver updateDriver(String tenantCode, String actor, UUID id, DriverRequest body) {
        DriverRequest req = body == null ? DriverRequest.empty() : body;
        Driver d = store.findDriver(tenantCode, id)
                .orElseThrow(() -> new NoSuchElementException("driver not found"));
        String firstName = Check.orKeep(req.firstName(), d.firstName(), "firstName", 128);
        String lastName = Check.orKeep(req.lastName(), d.lastName(), "lastName", 128);
        String fullName = req.fullName() == null && (req.firstName() != null || req.lastName() != null)
                ? join(firstName, lastName) : Check.orKeep(req.fullName(), d.fullName(), "fullName", 255);
        Driver updated = store.updateDriver(new Driver(d.id(), tenantCode,
                req.carrierId() == null ? d.carrierId()
                        : req.carrierId().isBlank() ? null : carrierId(req.carrierId()),
                Check.orKeep(req.externalId(), d.externalId(), "externalId", 128),
                req.rut() == null ? d.rut() : Check.required(req.rut(), "rut", 32),
                firstName,
                lastName,
                Check.limitedOrNull(fullName, "fullName", 255),
                Check.orKeep(req.phone(), d.phone(), "phone", 64),
                Check.orKeep(req.mobilePhone(), d.mobilePhone(), "mobilePhone", 64),
                Check.orKeep(req.licenseCategory(), d.licenseCategory(), "licenseCategory", 16),
                req.licenseExpires() == null ? d.licenseExpires() : req.licenseExpires(),
                req.status() == null ? d.status() : Check.required(req.status(), "status", 32),
                req.isOccasional() == null ? d.isOccasional() : req.isOccasional(),
                d.sourceSystem(), d.sourceData(), d.createdAt(), d.createdBy(), null, actor))
                .orElseThrow(() -> new NoSuchElementException("driver not found"));
        return updated;
    }

    // ---- shared ---------------------------------------------------------

    private static int page(Integer page) {
        return page == null ? 0 : Math.max(page, 0);
    }

    private static int size(Integer size) {
        int s = size == null ? 50 : size;
        if (s < 1 || s > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("size must be between 1 and " + MAX_PAGE_SIZE);
        }
        return s;
    }

    static java.util.UUID parse(String raw, String field) {
        try {
            return java.util.UUID.fromString(raw);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(field + " must be a UUID");
        }
    }

    private static String carrierId(String raw) {
        String id = Check.required(raw, "carrierId", 64);
        parse(id, "carrierId");
        return id;
    }

    private static String join(String first, String last) {
        if (first == null && last == null) {
            return null;
        }
        return ((first == null ? "" : first.trim()) + " " + (last == null ? "" : last.trim())).trim();
    }
}
