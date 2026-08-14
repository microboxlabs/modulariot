package com.microboxlabs.miot.symptoms.process;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.core.Vertx;
import java.util.Optional;
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

    @Test
    void parseUrlStripsUserinfo() {
        var parsed = StreamhubSymptomsGpsClient.parseUrl(
                "postgresql://svc:secret@db-host:5432/prod_iot_gps");
        assertEquals("db-host", parsed.host());
        assertEquals(5432, parsed.port());
        assertEquals("prod_iot_gps", parsed.database());
    }

    @Test
    void parseUrlRejectsMalformedPort() {
        IllegalArgumentException err = assertThrows(
                IllegalArgumentException.class,
                () -> StreamhubSymptomsGpsClient.parseUrl("postgresql://db-host:notaport/prod_iot_gps"));
        assertTrue(err.getMessage().contains("port"));
    }

    @Test
    void unconfiguredGpsFailsAsUni() {
        Vertx vertx = Vertx.vertx();
        try {
            var client = new StreamhubSymptomsGpsClient(
                    vertx, Optional.empty(), Optional.empty(), Optional.empty(), 8);
            Uni<JsonObject> uni = client.invoke("process_symptoms_lost_signal", new JsonObject());
            IllegalStateException err =
                    assertThrows(IllegalStateException.class, () -> uni.await().indefinitely());
            assertTrue(err.getMessage().contains("not configured"));
        } finally {
            vertx.close().await().indefinitely();
        }
    }
}
