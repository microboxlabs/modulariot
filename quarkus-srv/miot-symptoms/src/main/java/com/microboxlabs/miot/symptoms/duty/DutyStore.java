package com.microboxlabs.miot.symptoms.duty;

/** The duty counters by organization and vehicle. */
public interface DutyStore {

    /** The state and the duty restarts requested so far; a state of null when the vehicle has none. */
    record Loaded(DutyState state, long restarts) {
    }

    Loaded load(String tenantCode, String assetId);

    void save(String tenantCode, String assetId, DutyState state);

    /** Ends the vehicle's duty count; the frame after it starts a new one. Safe while a frame is being applied. */
    void restartDuty(String tenantCode, String assetId);
}
