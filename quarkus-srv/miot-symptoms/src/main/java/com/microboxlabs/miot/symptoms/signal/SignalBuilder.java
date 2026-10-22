package com.microboxlabs.miot.symptoms.signal;

import cl.streamhub.gps.model.AssetTrackingData;
import cl.streamhub.gps.model.EnvelopedMessage;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;

/**
 * Builds {@link GpsSignal}s from GPS frames and the reference cache. What it
 * does not know yet is left out: the vehicle, the road limits, the zones and
 * the derived values.
 */
public class SignalBuilder {

    /** Above this speed the vehicle is moving, as in the GPS database's signal function (2.78 m/s). */
    static final double MOVING_KMH = 10;
    private static final String M2M_SUFFIX = "@clients";

    private final ReferenceCache refs;
    private final ZoneId zone;

    public SignalBuilder(ReferenceCache refs, ZoneId zone) {
        this.refs = refs;
        this.zone = zone;
    }

    /** The signal, or empty when the frame has no vehicle id or time. */
    public Optional<GpsSignal> build(EnvelopedMessage message) {
        AssetTrackingData frame = message.getPayload();
        if (frame == null || frame.getAssetId() == null || frame.getAssetId().isBlank()
                || frame.getTimestamp() == null) {
            return Optional.empty();
        }
        String assetId = frame.getAssetId();
        Instant at = frame.getTimestamp().toInstant();
        GpsSignal.Trip trip = refs.tripAt(assetId, at)
                .map(t -> new GpsSignal.Trip(true, t.doubleDriver(), t.tripId()))
                .orElse(new GpsSignal.Trip(false, false, null));
        Double speed = frame.getGps() == null ? null : frame.getGps().getSpeed();
        Boolean engineOn = frame.getSensors() == null ? null : frame.getSensors().getEngineStatus();
        GpsSignal.Gps gps = new GpsSignal.Gps(speed, engineOn, speed == null ? null : speed > MOVING_KMH);
        return Optional.of(new GpsSignal(GpsSignal.SCHEMA_ID, assetId, at,
                refs.clientsAt(assetId, sender(message.getClientId()), at), trip, null, gps, null, null,
                at.atZone(zone).getHour(), null, frame));
    }

    /** The sending client's id as the GPS database stores it, without the M2M suffix. */
    static String sender(String clientId) {
        if (clientId == null) {
            return null;
        }
        return clientId.endsWith(M2M_SUFFIX) ? clientId.substring(0, clientId.length() - M2M_SUFFIX.length())
                : clientId;
    }
}
