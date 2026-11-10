package com.microboxlabs.miot.trips.events;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class TripEventsTest {

    @Test
    void carrierIdsUseTheContactBooksForm() {
        assertEquals("000000030", TripEvents.rut(" 00.000.003-0 "));
        assertEquals("00000002K", TripEvents.rut("00.000.002-k"));
    }

    @Test
    void aCarrierIdWithOnlySeparatorsIsAbsent() {
        assertNull(TripEvents.rut(" . - \t "));
    }
}
