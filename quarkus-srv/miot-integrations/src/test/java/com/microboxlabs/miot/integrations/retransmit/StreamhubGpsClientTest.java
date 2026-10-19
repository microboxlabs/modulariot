package com.microboxlabs.miot.integrations.retransmit;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class StreamhubGpsClientTest {

    @Test
    void dropsUserInfoFromTheSharedUrl() {
        var options = StreamhubGpsClient.connectOptions("postgresql://user@db.internal:6432/gps?application_name=x");
        assertEquals("db.internal", options.getHost());
        assertEquals(6432, options.getPort());
        assertEquals("gps", options.getDatabase());
    }

    @Test
    void readsUrlWithoutScheme() {
        var options = StreamhubGpsClient.connectOptions("db.internal:5433/prod_iot_gps");
        assertEquals("db.internal", options.getHost());
        assertEquals(5433, options.getPort());
        assertEquals("prod_iot_gps", options.getDatabase());
    }
}
