package com.microboxlabs.miot.symptoms.process;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class StreamhubSymptomsGpsClientTest {

    @Test
    void parsePostgresqlUrl() {
        var parsed = StreamhubSymptomsGpsClient.parseUrl(
                "postgresql://prod-streamhub-cloudsql-proxy:5432/prod_iot_gps?application_name=miot-symptoms");
        assertEquals("prod-streamhub-cloudsql-proxy", parsed.host());
        assertEquals(5432, parsed.port());
        assertEquals("prod_iot_gps", parsed.database());
    }

    @Test
    void parseBareHostDb() {
        var parsed = StreamhubSymptomsGpsClient.parseUrl("localhost/symptoms");
        assertEquals("localhost", parsed.host());
        assertEquals(5432, parsed.port());
        assertEquals("symptoms", parsed.database());
    }
}
