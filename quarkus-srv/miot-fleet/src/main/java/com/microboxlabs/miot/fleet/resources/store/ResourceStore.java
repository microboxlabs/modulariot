package com.microboxlabs.miot.fleet.resources.store;

import com.microboxlabs.miot.fleet.resources.domain.Carrier;
import com.microboxlabs.miot.fleet.resources.domain.Driver;
import com.microboxlabs.miot.fleet.resources.domain.Trailer;
import com.microboxlabs.miot.fleet.resources.domain.Truck;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** The resource directory: carriers, trucks, trailers, drivers. Every call is tenant-scoped. */
public interface ResourceStore {

    Carrier insertCarrier(Carrier carrier);

    Optional<Carrier> findCarrier(String tenantCode, UUID id);

    List<Carrier> listCarriers(String tenantCode, String q, int page, int size);

    Optional<Carrier> updateCarrier(Carrier carrier);

    Truck insertTruck(Truck truck);

    Optional<Truck> findTruck(String tenantCode, UUID id);

    List<Truck> listTrucks(String tenantCode, String plate, UUID carrierId, int page, int size);

    Optional<Truck> updateTruck(Truck truck);

    Trailer insertTrailer(Trailer trailer);

    Optional<Trailer> findTrailer(String tenantCode, UUID id);

    List<Trailer> listTrailers(String tenantCode, String plate, int page, int size);

    Optional<Trailer> updateTrailer(Trailer trailer);

    Driver insertDriver(Driver driver);

    Optional<Driver> findDriver(String tenantCode, UUID id);

    List<Driver> listDrivers(String tenantCode, String rut, String q, int page, int size);

    Optional<Driver> updateDriver(Driver driver);

    /**
     * Whether {@code id} is a current row of {@code table} (carrier, truck, trailer, driver) that is neither deleted
     * nor switched off ({@code status = 'inactive'}); no row lock.
     */
    boolean isCurrent(String tenantCode, String table, UUID id);
}
