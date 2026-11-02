package com.microboxlabs.miot.symptoms.lostsignal;

import java.time.Instant;
import java.util.List;

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

    /** Intervals between consecutive frames of an asset and sender in {@code [from, to)}, by sender and second. */
    List<Count> intervals(Instant from, Instant to);

    /** The frames in {@code [from, to)}, ordered by asset, sender and time. */
    List<GpsRow> frames(Instant from, Instant to);
}
