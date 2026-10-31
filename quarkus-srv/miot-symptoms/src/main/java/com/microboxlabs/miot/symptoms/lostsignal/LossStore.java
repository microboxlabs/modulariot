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
     * @param returnedAt when the first frame after the loss arrived, null before
     * @param backfill   frames from inside the silence arrived after it
     */
    record Vehicle(VehicleProfile profile, Watch watch, CheckState check, Instant returnedAt, boolean backfill) {

        public Vehicle(VehicleProfile profile, Watch watch, CheckState check) {
            this(profile, watch, check, null, false);
        }
    }

    /**
     * What a frame tells about the vehicle's current loss: the first frame after it arrived ({@code returnedAt},
     * kept once set), or a frame from inside the silence arrived ({@code backfill}). Both belong to the loss that
     * started at {@code lostSince} and are ignored for any other.
     */
    record Mark(Instant lostSince, Instant returnedAt, boolean backfill) {
    }

    /** What a frame does to the vehicle's next check: nothing, drop it (no trip), or move it. */
    record Schedule(Kind kind, Instant at, Watch watch) {

        public enum Kind {
            KEEP, DROP, AT
        }

        public static final Schedule KEEP = new Schedule(Kind.KEEP, null, null);
        public static final Schedule DROP = new Schedule(Kind.DROP, null, null);

        public static Schedule at(Instant at, Watch watch) {
            return new Schedule(Kind.AT, at, watch);
        }
    }

    /** @param sender null when the frame names none */
    Profiles load(String assetId, String sender);

    /** @param senderProfile ignored when {@code sender} is null */
    default void save(String assetId, VehicleProfile vehicle, String sender, SenderProfile senderProfile) {
        save(assetId, vehicle, sender, senderProfile, Schedule.KEEP, null);
    }

    /** @param mark null when the vehicle is not lost or the frame tells nothing about its loss */
    void save(String assetId, VehicleProfile vehicle, String sender, SenderProfile senderProfile, Schedule schedule,
            Mark mark);

    /** The vehicles whose deadline is at or before {@code now}, earliest first. */
    List<String> due(Instant now, int limit);

    Vehicle vehicle(String assetId);

    /**
     * Writes what a check found and moves the vehicle's deadline to {@code next}, unless a frame dropped it
     * meanwhile; {@code next} null drops it. A state that is not lost clears the loss's marks.
     */
    void checked(String assetId, CheckState check, Instant next);

    /** Takes or keeps the ticker's lease; false while another replica holds it. */
    boolean lease(String owner, Duration ttl);

    void heartbeat(Heartbeat beat);

    List<Heartbeat> heartbeats();
}
