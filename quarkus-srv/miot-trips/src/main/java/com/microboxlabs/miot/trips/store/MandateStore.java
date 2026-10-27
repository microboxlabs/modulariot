package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.trips.domain.Mandate;
import com.microboxlabs.miot.trips.domain.MandateLine;
import com.microboxlabs.miot.trips.domain.TripRef;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Mandates (order headers) and their single v1 line. Every call is tenant-scoped. */
public interface MandateStore {

    /** Inserts, or returns the existing mandate with the same (tenant, externalCode). */
    CreateOrGet insertOrGet(Mandate mandate);

    Optional<Mandate> find(String tenantCode, UUID id);

    Optional<Mandate> findByCode(String tenantCode, String externalCode);

    List<Mandate> list(String tenantCode, String status, String externalCode, int page, int size);

    /** Patches header fields; null keeps, empty clears. Returns the updated row. */
    Optional<Mandate> update(Mandate mandate);

    Optional<MandateLine> lineOf(String tenantCode, UUID mandateId);

    /** The status, read FOR SHARE: a new link waits for a concurrent close and sees its result. */
    Optional<String> statusForLink(String tenantCode, UUID mandateId);

    List<TripRef> tripsOf(String tenantCode, UUID mandateId);

    /** Trips of the mandate not yet completed or cancelled; closing requires zero. */
    int openTrips(String tenantCode, UUID mandateId);

    record CreateOrGet(Mandate mandate, boolean created) {
    }
}
