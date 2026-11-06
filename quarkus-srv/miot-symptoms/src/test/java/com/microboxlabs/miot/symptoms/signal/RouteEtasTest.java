package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import org.junit.jupiter.api.Test;

class RouteEtasTest {

    @Test
    void theTokenIsTheLevel12CellAsTheGpsDatabaseWritesIt() {
        assertEquals("9662c51", RouteEtas.token(-70.66, -33.45));
        assertEquals(7, RouteEtas.token(-70.66, -33.45).length(), "level 12: 7 hex digits");
    }

    @Test
    void findsTheRouteCellOfThePoint() {
        RouteEtas etas = new RouteEtas();
        String cell = RouteEtas.token(-70.66, -33.45);
        etas.load(List.of(new RouteEtas.Cell(32, 17, cell, 3600), new RouteEtas.Cell(17, 32, cell, 60)));

        assertEquals(3600, etas.remainingSeconds(32, 17, -70.66, -33.45));
        assertEquals(60, etas.remainingSeconds(17, 32, -70.661, -33.451), "same cell, other route");
        assertNull(etas.remainingSeconds(32, 18, -70.66, -33.45), "another destination");
        assertNull(etas.remainingSeconds(32, 17, -70.40, -33.20), "a cell the route's trips never crossed");
    }

    @Test
    void aReloadReplacesTheCells() {
        RouteEtas etas = new RouteEtas();
        etas.load(List.of(new RouteEtas.Cell(32, 17, RouteEtas.token(-70.66, -33.45), 3600)));
        etas.load(List.of());

        assertEquals(0, etas.size());
        assertNull(etas.remainingSeconds(32, 17, -70.66, -33.45));
    }
}
