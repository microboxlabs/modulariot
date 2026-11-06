package com.microboxlabs.miot.places.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.microboxlabs.miot.places.store.PlaceStore;

/**
 * Checks a place's GeoJSON Feature and keeps only what the map needs: {@code type}, {@code geometry} and
 * {@code properties}. Coordinates are [lon, lat]. A geofence or inner geofence is a Polygon (closed rings of at least
 * four positions); a route is a LineString of at least two positions. A circle arrives as a Point with
 * {@code properties.radius_m} above zero and is stored as a polygon of {@value #CIRCLE_SEGMENTS} sides, with
 * {@code properties.shape = "circle"}, {@code properties.center} and {@code properties.radius_m}, so the map can still
 * edit it as a circle and every consumer evaluates one kind of shape.
 */
final class PlaceShapes {

    static final int CIRCLE_SEGMENTS = 64;
    static final String SHAPE = "shape";
    static final String CIRCLE = "circle";
    static final String CENTER = "center";
    static final String RADIUS = "radius_m";

    private static final double EARTH_RADIUS_M = 6_371_008.8;
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private PlaceShapes() {
    }

    /** The Feature as JSON text to store; {@link IllegalArgumentException} names what is wrong. */
    static String feature(String kind, JsonNode geojson) {
        if (geojson == null || !geojson.isObject() || !"Feature".equals(geojson.path("type").asText())) {
            throw new IllegalArgumentException("geojson must be a GeoJSON Feature");
        }
        JsonNode geometry = geojson.path("geometry");
        String type = geometry.path("type").asText();
        JsonNode raw = geojson.path("properties");
        ObjectNode properties;
        if (raw.isMissingNode() || raw.isNull()) {
            properties = MAPPER.createObjectNode();
        } else if (raw.isObject()) {
            properties = ((ObjectNode) raw).deepCopy();
        } else {
            throw new IllegalArgumentException("geojson.properties must be an object");
        }
        boolean route = PlaceStore.ROUTE.equals(kind);
        if (route != "LineString".equals(type)) {
            throw new IllegalArgumentException(route
                    ? "a route must be a LineString"
                    : "a geofence must be a Polygon or a Point with properties.radius_m");
        }
        JsonNode coordinates = geometry.path("coordinates");
        switch (type) {
            case "Polygon" -> {
                polygon(coordinates);
                // a polygon edited by hand is no longer a circle
                if (CIRCLE.equals(properties.path(SHAPE).asText())) {
                    properties.remove(SHAPE);
                    properties.remove(RADIUS);
                }
            }
            case "Point" -> {
                double radius = radius(properties.path(RADIUS));
                position(coordinates);
                double lon = coordinates.get(0).asDouble();
                double lat = coordinates.get(1).asDouble();
                properties.put(SHAPE, CIRCLE);
                properties.set(CENTER, MAPPER.createArrayNode().add(lon).add(lat));
                properties.put(RADIUS, radius);
                type = "Polygon";
                coordinates = MAPPER.createArrayNode().add(ring(lon, lat, radius));
            }
            case "LineString" -> line(coordinates, 2, "a route needs at least two positions");
            default -> throw new IllegalArgumentException("geojson.geometry must be a Polygon, Point or LineString");
        }
        ObjectNode out = MAPPER.createObjectNode();
        out.put("type", "Feature");
        out.set("geometry", MAPPER.createObjectNode().put("type", type).set("coordinates", coordinates));
        out.set("properties", properties);
        try {
            return MAPPER.writeValueAsString(out);
        } catch (Exception e) {
            throw new IllegalArgumentException("geojson could not be written", e);
        }
    }

    /**
     * A closed ring around [lon, lat] at {@code radiusM} meters, on a sphere: each vertex is the destination point at
     * that distance along an evenly spaced bearing.
     */
    static ArrayNode ring(double lon, double lat, double radiusM) {
        double d = radiusM / EARTH_RADIUS_M;
        double phi = Math.toRadians(lat);
        double lambda = Math.toRadians(lon);
        ArrayNode ring = MAPPER.createArrayNode();
        for (int i = 0; i < CIRCLE_SEGMENTS; i++) {
            double bearing = 2 * Math.PI * i / CIRCLE_SEGMENTS;
            double phi2 = Math.asin(Math.sin(phi) * Math.cos(d) + Math.cos(phi) * Math.sin(d) * Math.cos(bearing));
            double lambda2 = lambda + Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(phi),
                    Math.cos(d) - Math.sin(phi) * Math.sin(phi2));
            double lon2 = (Math.toDegrees(lambda2) + 540) % 360 - 180;
            ring.add(MAPPER.createArrayNode().add(round(lon2)).add(round(Math.toDegrees(phi2))));
        }
        ring.add(ring.get(0).deepCopy());
        return ring;
    }

    /** About a centimeter: enough for a geofence, and keeps the stored JSON short. */
    private static double round(double degrees) {
        return Math.round(degrees * 1e7) / 1e7;
    }

    private static void polygon(JsonNode rings) {
        if (!rings.isArray() || rings.isEmpty()) {
            throw new IllegalArgumentException("a polygon needs at least one ring");
        }
        for (JsonNode ring : rings) {
            line(ring, 4, "a polygon ring needs at least four positions, the last repeating the first");
            if (!ring.get(0).equals(ring.get(ring.size() - 1))) {
                throw new IllegalArgumentException(
                        "a polygon ring must be closed: the last position repeats the first");
            }
        }
    }

    private static double radius(JsonNode radius) {
        if (!radius.isNumber() || radius.asDouble() <= 0) {
            throw new IllegalArgumentException("a circle needs properties.radius_m above zero");
        }
        return radius.asDouble();
    }

    private static void line(JsonNode positions, int min, String tooShort) {
        if (!positions.isArray() || positions.size() < min) {
            throw new IllegalArgumentException(tooShort);
        }
        positions.forEach(PlaceShapes::position);
    }

    private static void position(JsonNode p) {
        if (!p.isArray() || p.size() < 2 || !p.get(0).isNumber() || !p.get(1).isNumber()) {
            throw new IllegalArgumentException("a position is [lon, lat] in numbers");
        }
        double lon = p.get(0).asDouble();
        double lat = p.get(1).asDouble();
        if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
            throw new IllegalArgumentException("a position is out of range: [lon, lat] is [" + lon + ", " + lat + "]");
        }
    }
}
