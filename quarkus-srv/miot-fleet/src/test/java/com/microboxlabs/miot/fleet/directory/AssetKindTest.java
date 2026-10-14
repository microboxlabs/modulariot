package com.microboxlabs.miot.fleet.directory;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class AssetKindTest {

    @Test
    void mapsTheTypesProvidersReport() {
        assertEquals(AssetKind.TRUCK, AssetKind.fromReported("Truck"));
        assertEquals(AssetKind.TRUCK, AssetKind.fromReported("CAMIÓN"));
        assertEquals(AssetKind.TRUCK, AssetKind.fromReported("Scania R-480"));
        assertEquals(AssetKind.TRAILER, AssetKind.fromReported("Jaula"));
        assertEquals(AssetKind.TRAILER, AssetKind.fromReported("rampla plana"));
        assertEquals(AssetKind.DECOY, AssetKind.fromReported("Señuelo"));
        assertEquals(AssetKind.PERSON, AssetKind.fromReported("conductor"));
        assertEquals(AssetKind.OTHER, AssetKind.fromReported("NO DEFINIDO"));
        assertEquals(AssetKind.OTHER, AssetKind.fromReported(" "));
    }

    @Test
    void parsesOnlyKnownKinds() {
        assertEquals(AssetKind.TRAILER, AssetKind.parse(" trailer "));
        assertNull(AssetKind.parse("bus"));
    }
}
