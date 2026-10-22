package com.microboxlabs.miot.symptoms.signal;

import cl.streamhub.gps.model.AssetTrackingData;
import cl.streamhub.gps.model.EnvelopedMessage;
import java.time.Duration;
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
        GpsSignal.Trip trip = refs.tripAt(assetId, at).map(t -> trip(t, at)).orElse(GpsSignal.Trip.none());
        Double speed = frame.getGps() == null ? null : frame.getGps().getSpeed();
        Boolean engineOn = frame.getSensors() == null ? null : frame.getSensors().getEngineStatus();
        GpsSignal.Gps gps = new GpsSignal.Gps(speed, engineOn, speed == null ? null : speed > MOVING_KMH);
        return Optional.of(new GpsSignal(GpsSignal.SCHEMA_ID, assetId, at,
                refs.clientsAt(assetId, sender(message.getClientId()), at), trip, null, gps, null, null,
                at.atZone(zone).getHour(), null, frame));
    }

    /** The trip in progress as the signal carries it, timed against the frame. */
    GpsSignal.Trip trip(ReferenceCache.Trip t, Instant at) {
        ReferenceCache.TripDetails d = t.details();
        GpsSignal.Origin origin = d.originId() == null && d.originLabel() == null ? null
                : new GpsSignal.Origin(d.originId(), d.originLabel(), d.originVisited(), d.originInternal());
        GpsSignal.Destination destination = d.destinationId() == null && d.destinationLabel() == null ? null
                : new GpsSignal.Destination(d.destinationId(), d.destinationLabel(), d.destinationVisited());
        GpsSignal.Carrier carrier = d.carrierId() == null && d.carrierName() == null ? null
                : new GpsSignal.Carrier(d.carrierId(), d.carrierName());
        Integer currentZone = d.currentGeofenceId() == null || d.currentGeofenceId() == 0 ? null : d.currentGeofenceId();
        return new GpsSignal.Trip(true, t.doubleDriver(), t.tripId(), t.tripType(), minutes(t.startTime(), at),
                minutes(d.eta(), at), origin, destination, currentZone, carrier, d.loadType(), d.trailerPlate(),
                driver(d, at));
    }

    /** Registry id, status and license of the trip's driver; whether they are registered only once it is loaded. */
    private GpsSignal.Driver driver(ReferenceCache.TripDetails d, Instant at) {
        // Checked before the lookup: once loaded the registry is never unloaded, so the lookup sees it too.
        if (d.driverNationalId() == null || d.driverNationalId().isBlank() || !refs.driversLoaded()) {
            return null;
        }
        return refs.driver(d.driverNationalId(), d.createdBy())
                .map(r -> new GpsSignal.Driver(r.id(), true, status(r.status()),
                        r.licenseExpires() == null ? null : r.licenseExpires().isBefore(at)))
                .orElse(new GpsSignal.Driver(null, false, null, null));
    }

    private static GpsSignal.DriverStatus status(String status) {
        try {
            return status == null ? null : GpsSignal.DriverStatus.valueOf(status);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** Minutes from {@code from} to {@code at}, one decimal; negative when {@code from} is later. */
    static Double minutes(Instant from, Instant at) {
        if (from == null) {
            return null;
        }
        return Math.round(Duration.between(from, at).toSeconds() / 6.0) / 10.0;
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
