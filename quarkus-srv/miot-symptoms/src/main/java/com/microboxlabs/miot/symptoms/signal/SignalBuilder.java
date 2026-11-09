package com.microboxlabs.miot.symptoms.signal;

import cl.streamhub.gps.model.AssetTrackingData;
import cl.streamhub.gps.model.EnvelopedMessage;
import cl.streamhub.gps.model.Event;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Builds {@link GpsSignal}s from GPS frames, the reference cache and the
 * clients' zones, the road network's limits and each client's own limits. What
 * it does not know yet is left out: the vehicle and the 5-minute average speed.
 */
public class SignalBuilder {

    /** Above this speed the vehicle is moving, as in the GPS database's signal function (2.78 m/s). */
    static final double MOVING_KMH = 10;
    private static final String M2M_SUFFIX = "@clients";
    /**
     * Device event types of external power disconnected, as GPS providers name them: "ALIMENTACION BATERIA
     * DESCONECTADA", "EVENTO_SMDP_ALIMENTACION_EXTERNA_DESCONECTADA", "power disconnected", "power cut".
     */
    static final Pattern POWER_DISCONNECTED = Pattern.compile(
            "(?iu)alimentaci[oó]n[^\\n]*desconectad|power[^\\n]*(disconnect|cut)");
    /** GNSS or GSM jamming events ("GpsJammingDetected", "GSM jamming", "JAMMING"). */
    static final Pattern JAMMING = Pattern.compile("(?iu)jamm");

    private final ReferenceCache refs;
    private final ZoneId zone;
    private final Zones zones;
    private final RoadNetwork roads;
    private final SpeedZones speedZones;
    private final Bearings bearings;
    private final RouteEtas routeEtas;

    public SignalBuilder(ReferenceCache refs, ZoneId zone) {
        this(refs, zone, new Zones());
    }

    public SignalBuilder(ReferenceCache refs, ZoneId zone, Zones zones) {
        this(refs, zone, zones, null, new SpeedZones(), new Bearings(Duration.ofMinutes(10)));
    }

    /** @param roads null when the builder has no road network */
    public SignalBuilder(ReferenceCache refs, ZoneId zone, Zones zones, RoadNetwork roads, SpeedZones speedZones,
            Bearings bearings) {
        this(refs, zone, zones, roads, speedZones, bearings, new RouteEtas());
    }

    /** @param roads null when the builder has no road network */
    public SignalBuilder(ReferenceCache refs, ZoneId zone, Zones zones, RoadNetwork roads, SpeedZones speedZones,
            Bearings bearings, RouteEtas routeEtas) {
        this.refs = refs;
        this.zone = zone;
        this.zones = zones;
        this.roads = roads;
        this.speedZones = speedZones;
        this.bearings = bearings;
        this.routeEtas = routeEtas;
    }

    /** The signal, or empty when the frame has no vehicle id or time. */
    public Optional<GpsSignal> build(EnvelopedMessage message) {
        AssetTrackingData frame = message.getPayload();
        if (!validFrame(frame)) {
            return Optional.empty();
        }
        String assetId = frame.getAssetId();
        Instant at = frame.getTimestamp().toInstant();
        String sender = sender(message.getClientId());
        List<String> clients = refs.clientsAt(assetId, sender, at);
        Map<String, GpsSignal.Trip> trips = new LinkedHashMap<>();
        Double lon = hasPosition(frame) ? frame.getGps().getLongitude() : null;
        Double lat = hasPosition(frame) ? frame.getGps().getLatitude() : null;
        refs.tripsAt(assetId, at, clients).forEach((client, t) -> trips.put(client, trip(t, at, lon, lat)));
        Boolean moving = frame.getGps() == null ? null : frame.getGps().getSpeed() > MOVING_KMH;
        GpsSignal.Derived derived = new GpsSignal.Derived(moving, null, event(frame, POWER_DISCONNECTED),
                event(frame, JAMMING));
        LocalTime local = at.atZone(zone).toLocalTime();
        Map<String, GpsSignal.Geo> geos = geos(frame, clients, local);
        Map<String, GpsSignal.Road> roadsByClient = roads(frame, assetId, at, clients);
        // The time the platform's gateway received the frame (X-Request-Timestamp), carried by the envelope.
        return Optional.of(new GpsSignal(GpsSignal.SCHEMA_ID, assetId, at, message.getTimestamp(), clients, sender, null,
                trips.isEmpty() ? null : trips, null, null, null, roadsByClient.isEmpty() ? null : roadsByClient, null,
                geos.isEmpty() ? null : geos,
                local.getHour(), local.toSecondOfDay() / 60.0, derived, frame));
    }

    /**
     * Each client's zones at the frame's position and local time (the one {@code local_minutes} reads); none for a
     * frame without a position or a client without zones.
     */
    private Map<String, GpsSignal.Geo> geos(AssetTrackingData frame, List<String> clients, LocalTime local) {
        Map<String, GpsSignal.Geo> out = new LinkedHashMap<>();
        if (!hasPosition(frame)) {
            return out;
        }
        double lon = frame.getGps().getLongitude();
        double lat = frame.getGps().getLatitude();
        for (String client : clients) {
            GpsSignal.Geo geo = zones.at(client, lon, lat, local);
            if (geo != null) {
                out.put(client, geo);
            }
        }
        return out;
    }

    /**
     * Each client's limits at the frame's position: the road network's, the same for every client, and the
     * client's own. A client gets none when neither is known. The road limit is for a heavy vehicle until the
     * signal knows the vehicle, as the GPS database's speed function does without a weight.
     */
    private Map<String, GpsSignal.Road> roads(AssetTrackingData frame, String assetId, Instant at,
            List<String> clients) {
        Map<String, GpsSignal.Road> out = new LinkedHashMap<>();
        if (!hasPosition(frame)) {
            return out;
        }
        double lon = frame.getGps().getLongitude();
        double lat = frame.getGps().getLatitude();
        Integer bearing = bearings.next(assetId, at, lon, lat);
        RoadNetwork.Limit osm = roads == null ? null : roads.at(lon, lat, GpsSignal.WeightCategory.HEAVY);
        Double heading = frame.getGps().headingOrNull();
        for (String client : clients) {
            SpeedZones.Limit own = speedZones.at(client, lon, lat, heading, bearing);
            if (osm == null && own == null) {
                continue;
            }
            out.put(client, road(osm, own));
        }
        return out;
    }

    private static GpsSignal.Road road(RoadNetwork.Limit osm, SpeedZones.Limit own) {
        return new GpsSignal.Road(osm == null ? null : osm.maxspeed(), own == null ? null : own.maxspeed(),
                osm == null ? null : osm.wayId(), osm == null ? null : osm.roadClass(),
                own == null ? null : own.zoneId(), own == null ? null : own.zoneName());
    }

    static boolean validFrame(AssetTrackingData frame) {
        return frame != null && frame.getAssetId() != null && !frame.getAssetId().isBlank()
                && frame.getTimestamp() != null;
    }

    static boolean hasPosition(AssetTrackingData frame) {
        if (frame == null || frame.getGps() == null) {
            return false;
        }
        double lon = frame.getGps().getLongitude();
        double lat = frame.getGps().getLatitude();
        return Double.isFinite(lon) && Double.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90
                && (lon != 0 || lat != 0);
    }

    /** True when one of the frame's events matches, false otherwise: a rule reads it without {@code has()}. */
    static boolean event(AssetTrackingData frame, Pattern type) {
        return frame.getEvents() != null && frame.getEvents().stream().filter(Objects::nonNull).map(Event::getEventType)
                .anyMatch(t -> t != null && type.matcher(t.replace('_', ' ')).find());
    }

    /** The trip in progress as the signal carries it, timed against the frame; without a position. */
    GpsSignal.Trip trip(ReferenceCache.Trip t, Instant at) {
        return trip(t, at, null, null);
    }

    /** The trip in progress as the signal carries it, timed against the frame at {@code lon}, {@code lat}. */
    GpsSignal.Trip trip(ReferenceCache.Trip t, Instant at, Double lon, Double lat) {
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
                d.loadType(), d.trailerPlate(), driver(d, at), etaDeviation(d, at, lon, lat));
    }

    /**
     * Minutes from the trip's estimated arrival to the predicted one: the frame's time plus what the route's past
     * trips took from the frame's S2 cell to the destination. Positive when the trip will arrive late, negative
     * when early. Null without an estimated arrival, an origin, a destination or a position, and off the cells
     * the route's past trips crossed, as in the GPS database's signal function.
     */
    Double etaDeviation(ReferenceCache.TripDetails d, Instant at, Double lon, Double lat) {
        if (d.eta() == null || d.originId() == null || d.destinationId() == null || lon == null || lat == null) {
            return null;
        }
        Integer remaining = routeEtas.remainingSeconds(d.originId(), d.destinationId(), lon, lat);
        return remaining == null ? null : minutes(d.eta(), at.plusSeconds(remaining));
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
