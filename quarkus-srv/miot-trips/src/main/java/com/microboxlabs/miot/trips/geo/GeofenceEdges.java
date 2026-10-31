package com.microboxlabs.miot.trips.geo;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Where a trip's vehicle is among the trip's geofences, and the signals a move gives: {@code left_origin},
 * {@code entered_destination}, {@code entered_stop} and the like. When origin and destination are the same geofence,
 * entering it again after leaving is arriving at the destination.
 */
public final class GeofenceEdges {

    public static final String ORIGIN = "origin";
    public static final String DESTINATION = "destination";
    public static final String STOP = "stop";

    /** The geofences a trip watches and where its vehicle was last seen; {@code current} null when outside all. */
    public record Watch(Integer origin, Integer destination, List<Integer> stops, Integer current,
            boolean originVisited, boolean destinationVisited) {

        public List<Integer> geofences() {
            List<Integer> all = new ArrayList<>();
            if (origin != null) {
                all.add(origin);
            }
            if (destination != null && !destination.equals(origin)) {
                all.add(destination);
            }
            if (stops != null) {
                stops.stream().filter(s -> !all.contains(s)).forEach(all::add);
            }
            return all;
        }
    }

    /** One signal: {@code kind} like {@code entered_destination}, at that geofence. */
    public record Edge(String kind, int geofenceId) {
    }

    /** The state after a move, and the signals it gave in order: leaving first, then entering. */
    public record Move(Integer current, boolean originVisited, boolean destinationVisited, List<Edge> edges) {
    }

    private GeofenceEdges() {
    }

    /** The trip geofence that holds the point: the current one while it still does, else the first in plan order. */
    public static Integer zoneOf(Watch w, Map<Integer, GeoShape> shapes, double lon, double lat) {
        if (w.current() != null && holds(shapes, w.current(), lon, lat)) {
            return w.current();
        }
        return w.geofences().stream().filter(id -> holds(shapes, id, lon, lat)).findFirst().orElse(null);
    }

    /** The move to {@code zone}; no edges when it is where the vehicle already was. */
    public static Move move(Watch w, Integer zone) {
        if (Objects.equals(zone, w.current())) {
            return new Move(w.current(), w.originVisited(), w.destinationVisited(), List.of());
        }
        List<Edge> edges = new ArrayList<>();
        boolean originVisited = w.originVisited();
        boolean destinationVisited = w.destinationVisited();
        if (w.current() != null) {
            edges.add(new Edge("left_" + leftRole(w, w.current()), w.current()));
        }
        if (zone != null) {
            String role = enteredRole(w, zone);
            edges.add(new Edge("entered_" + role, zone));
            originVisited |= ORIGIN.equals(role);
            destinationVisited |= DESTINATION.equals(role);
        }
        return new Move(zone, originVisited, destinationVisited, List.copyOf(edges));
    }

    private static String enteredRole(Watch w, int zone) {
        if (Objects.equals(zone, w.destination()) && (!Objects.equals(zone, w.origin()) || w.originVisited())) {
            return DESTINATION;
        }
        return Objects.equals(zone, w.origin()) ? ORIGIN : STOP;
    }

    private static String leftRole(Watch w, int zone) {
        if (Objects.equals(zone, w.destination()) && (!Objects.equals(zone, w.origin()) || w.destinationVisited())) {
            return DESTINATION;
        }
        return Objects.equals(zone, w.origin()) ? ORIGIN : STOP;
    }

    private static boolean holds(Map<Integer, GeoShape> shapes, int id, double lon, double lat) {
        GeoShape shape = shapes.get(id);
        return shape != null && shape.contains(lon, lat);
    }
}
