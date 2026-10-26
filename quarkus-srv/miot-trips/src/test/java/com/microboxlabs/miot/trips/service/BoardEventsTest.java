package com.microboxlabs.miot.trips.service;

import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.ServiceUnavailableException;
import org.junit.jupiter.api.Test;

class BoardEventsTest {

    @Test
    void aDisabledListenerDoesNotClaimTheBoardIsLive() {
        BoardEvents events = new BoardEvents(() -> null, null, false);
        assertThrows(ServiceUnavailableException.class, () -> events.stream("tenant"));
    }
}
