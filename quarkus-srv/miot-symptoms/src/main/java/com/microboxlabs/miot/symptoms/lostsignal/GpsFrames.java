package com.microboxlabs.miot.symptoms.lostsignal;

import java.time.Instant;
import java.util.List;
import java.util.function.Consumer;

/** Reads of {@code asset_data} for the shadow map: frames with a position and a sender, by GPS time. */
public interface GpsFrames {

    /** How many of a sender's frames have this value, in whole seconds. */
    record Count(String sender, int seconds, long n) {
    }

    /** @param delayS gateway receive time minus GPS time, at least 0 */
    record GpsRow(String assetId, String sender, long atMs, double delayS, double lat, double lon) {
    }

    /** Delays in {@code [from, to)}, by sender and second. */
    List<Count> delays(Instant from, Instant to);

    /**
     * Intervals whose ending frame is in {@code [from, to)}, per asset and sender, grouped by sender and second.
     * An implementation may omit intervals crossing {@code from} that exceed its predecessor lookback.
     */
    List<Count> intervals(Instant from, Instant to);

    /**
     * Passes the frames in {@code [from, to)} to {@code each} as they are read, ordered by asset, sender and time.
     * An implementation holds a bounded number of them at a time, whatever the range has.
     *
     * @return how many frames were passed
     */
    long frames(Instant from, Instant to, Consumer<GpsRow> each);
}
