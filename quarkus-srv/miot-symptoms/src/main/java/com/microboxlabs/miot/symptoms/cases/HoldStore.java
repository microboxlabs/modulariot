package com.microboxlabs.miot.symptoms.cases;

import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;

/** The open "Ignorar condición" holds, read from the treatments. */
public interface HoldStore {

    /** Serializes hold changes for a vehicle across operators and timer pods. */
    default <T> T locked(String tenantCode, String assetId, Supplier<T> work) {
        synchronized (this) {
            return work.get();
        }
    }

    /** The organization's open holds, also those whose time ran out and the timer has not ended yet. */
    List<IgnoreHold> open(String tenantCode);

    /** Every organization's open holds, oldest first. */
    List<IgnoreHold> open(int limit);

    Optional<IgnoreHold> find(String tenantCode, String treatmentId);

    /** Whether the trip still runs; empty when the trips module cannot say. */
    Optional<Boolean> tripLive(String tenantCode, String tripId, String assetId);
}
