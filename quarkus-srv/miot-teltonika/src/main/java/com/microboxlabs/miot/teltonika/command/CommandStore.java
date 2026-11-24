package com.microboxlabs.miot.teltonika.command;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Commands and intensive-tracking periods. Blocking. */
public interface CommandStore {

    void insert(DeviceCommand command);

    Optional<DeviceCommand> find(UUID id);

    List<DeviceCommand> list(String imei, int limit);

    /** Oldest pending, not expired commands of the given devices. */
    List<DeviceCommand> pending(Collection<String> imeis, OffsetDateTime now, int limit);

    /** Whether the device has a pending or sent command with that purpose. */
    boolean hasOpen(String imei, String purpose);

    /** Pending → sent (the claim); false if another instance took it first. */
    boolean markSent(UUID id, OffsetDateTime at);

    /** Sent → pending: claimed but the session was busy, it waits for the next round. */
    void release(UUID id);

    void markAnswered(UUID id, String response, OffsetDateTime at);

    void markFailed(UUID id, String reason, OffsetDateTime at);

    /** Pending past their expiry → expired; returns how many. */
    int expire(OffsetDateTime now);

    void saveIntensive(IntensiveTracking tracking);

    Optional<IntensiveTracking> intensive(String imei);

    /** Active periods whose {@code until} passed. */
    List<IntensiveTracking> dueIntensive(OffsetDateTime now);

    /** Ends the period; false if it was already ended (another instance did it). */
    boolean endIntensive(String imei, OffsetDateTime at);

    /** Adds one value read before the change ({@code id:value}). */
    void addPreviousParam(String imei, int paramId, String value);

    void markRestored(String imei, OffsetDateTime at);

    /** Ended periods the device has not confirmed yet. */
    List<IntensiveTracking> unrestored();
}
