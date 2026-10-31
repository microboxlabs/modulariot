package com.microboxlabs.miot.symptoms.signal;

import cl.streamhub.gps.model.AssetTrackingData;
import cl.streamhub.gps.model.EnvelopedMessage;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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
        List<String> clients = refs.clientsAt(assetId, sender(message.getClientId()), at);
        Map<String, GpsSignal.Trip> trips = new LinkedHashMap<>();
        refs.tripsAt(assetId, at, clients).forEach((client, t) -> trips.put(client, trip(t, at)));
        Boolean moving = frame.getGps() == null ? null : frame.getGps().getSpeed() > MOVING_KMH;
        return Optional.of(new GpsSignal(GpsSignal.SCHEMA_ID, assetId, at, clients, trips.isEmpty() ? null : trips,
                null, null, null, null, at.atZone(zone).getHour(), new GpsSignal.Derived(moving, null), frame));
    }

    /** The trip in progress as the signal carries it, timed against the frame. */
    GpsSignal.Trip trip(ReferenceCache.Trip t, Instant at) {
        ReferenceCache.TripDetails d = t.details();
        GpsSignal.Origin origin = d.originId() == null && d.originLabel() == null ? null
                : new GpsSignal.Origin(d.originId(), d.originLabel(), d.originVisited(), d.originInternal());
        GpsSignal.Destination destination = d.destinationId() == null && d.destinationLabel() == null ? null
                : new GpsSignal.Destination(d.destinationId(), d.destinationLabel(), d.destinationVisited());
        GpsSignal.Carrier carrier = d.carrierTaxId() == null && d.carrierName() == null ? null
                : new GpsSignal.Carrier(d.carrierTaxId(), d.carrierName());
        Integer currentZone = d.currentGeofenceId() == null || d.currentGeofenceId() == 0 ? null : d.currentGeofenceId();
        return new GpsSignal.Trip(true, t.doubleDriver(), t.tripId(), d.code(), t.tripType(), t.status(),
                minutes(t.startTime(), at), minutes(d.eta(), at), origin, destination, currentZone, carrier,
                d.loadType(), d.trailerPlate(), driver(d, at));
    }

    /** The fleet's id, status and license of the trip's driver; null when the trip names none. */
    private static GpsSignal.Driver driver(ReferenceCache.TripDetails d, Instant at) {
        if (!d.driverAssigned()) {
            return null;
        }
        if (d.driverId() == null) {
            return new GpsSignal.Driver(null, false, null, null);
        }
        return new GpsSignal.Driver(d.driverId(), true, status(d.driverStatus()),
                d.driverLicenseExpires() == null ? null : d.driverLicenseExpires().isBefore(at));
    }

    /** The fleet writes {@code active} and {@code inactive}. */
    private static GpsSignal.DriverStatus status(String status) {
        if (status == null) {
            return null;
        }
        String s = status.trim().toUpperCase(Locale.ROOT);
        try {
            return "INACTIVE".equals(s) ? GpsSignal.DriverStatus.DEACTIVATED : GpsSignal.DriverStatus.valueOf(s);
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
