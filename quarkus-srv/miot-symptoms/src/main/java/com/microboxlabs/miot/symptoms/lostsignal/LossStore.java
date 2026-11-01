package com.microboxlabs.miot.symptoms.lostsignal;

import com.microboxlabs.miot.symptoms.lostsignal.IngestHealth.Heartbeat;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/** The lost-signal detector's state: in Redis, or in memory for one replica and for tests. */
public interface LossStore {

    /**
     * What a frame reads before it updates the profiles.
     *
     * @param vehicle null for a vehicle never seen; {@code sender} null for a sender never seen or unknown
     */
    record Profiles(VehicleProfile vehicle, SenderProfile sender, CheckState check) {

        public Profiles(VehicleProfile vehicle, SenderProfile sender) {
            this(vehicle, sender, null);
        }
    }

    /**
     * What a check reads; any part may be null.
     *
     * @param deadline the vehicle's deadline when read: its check writes only while it is unchanged
     */
    record Vehicle(VehicleProfile profile, Watch watch, CheckState check, Instant deadline) {
    }

    /**
     * What a frame does to the vehicle's next check: nothing, drop it (no trip), move it, or, for a lost vehicle
     * that left its trips, drop the watch and check it once at {@code at} so the check clears its state.
     */
    record Schedule(Kind kind, Instant at, Watch watch) {

        public enum Kind {
            KEEP, DROP, AT, CLEAR
        }

        public static final Schedule KEEP = new Schedule(Kind.KEEP, null, null);
        public static final Schedule DROP = new Schedule(Kind.DROP, null, null);

        public static Schedule at(Instant at, Watch watch) {
            return new Schedule(Kind.AT, at, watch);
        }

        public static Schedule clear(Instant at) {
            return new Schedule(Kind.CLEAR, at, null);
        }
    }

    /** @param sender null when the frame names none */
    Profiles load(String assetId, String sender);

    /** @param senderProfile ignored when {@code sender} is null */
    default void save(String assetId, VehicleProfile vehicle, String sender, SenderProfile senderProfile) {
        save(assetId, vehicle, sender, senderProfile, Schedule.KEEP);
    }

    void save(String assetId, VehicleProfile vehicle, String sender, SenderProfile senderProfile, Schedule schedule);

    /** The vehicles whose deadline is at or before {@code now}, earliest first. */
    List<String> due(Instant now, int limit);

    Vehicle vehicle(String assetId);

    /**
     * Writes what a check found and moves the vehicle's deadline to {@code next}, only while the deadline is still
     * {@code seen}, the one the check read: a frame that moved or dropped it meanwhile wins, and the next tick
     * reads the new state. {@code next} null drops it. {@link CheckState#NONE} clears the check's state.
     *
     * @return false when a frame changed the deadline and nothing was written
     */
    boolean checked(String assetId, Instant seen, CheckState check, Instant next);

    /** Takes or keeps the ticker's lease; false while another replica holds it. */
    boolean lease(String owner, Duration ttl);

    void heartbeat(Heartbeat beat);

    List<Heartbeat> heartbeats();
}
