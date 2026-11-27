package com.microboxlabs.miot.teltonika.ingest;

import cl.streamhub.gps.model.AssetTrackingData;
import com.microboxlabs.miot.teltonika.inputs.InputReading;
import java.time.Instant;
import java.util.function.Function;

/**
 * One record from any source (Teltonika native, Traccar), ready to be published: its time, whether
 * it carries a position, how to build the payload for an asset, and its inputs by canonical name.
 * The sink applies the same rules to all of them (time window, asset by time, duplicates, inputs).
 *
 * @param payload builds the payload for the asset; called once, only for records that will be
 *                published (it may keep state, e.g. over-speeding episodes)
 */
public record Candidate(Instant time, boolean hasPosition, Function<String, AssetTrackingData> payload,
        InputReading inputs) {
}
