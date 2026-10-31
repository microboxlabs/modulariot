package com.microboxlabs.miot.places.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.places.store.GeofenceStore;
import org.junit.jupiter.api.Test;

/** The stored JSON text becomes JSON; missing JSON stays null and unreadable JSON is an error. */
class GeofenceViewTest {

    private static GeofenceStore.Geofence geofence(String shape, String properties) {
        return new GeofenceStore.Geofence(7, "ARI", "Arica", "polygonal", null, shape, properties);
    }

    @Test
    void parsesTheShapeAndTheProperties() {
        GeofenceView view = GeofenceView.of(geofence(
                "{\"type\":\"MultiPolygon\",\"coordinates\":[]}", "{\"radius_meters\":120}"));
        assertEquals("MultiPolygon", view.shape().path("type").asText());
        assertEquals(120, view.properties().path("radius_meters").asInt());
        assertEquals("Arica", view.name());
    }

    @Test
    void missingJsonStaysNull() {
        GeofenceView view = GeofenceView.of(geofence(null, "  "));
        assertNull(view.shape());
        assertNull(view.properties());
    }

    @Test
    void unreadableJsonIsAnError() {
        assertThrows(IllegalStateException.class, () -> GeofenceView.of(geofence("{not json", null)));
    }
}
