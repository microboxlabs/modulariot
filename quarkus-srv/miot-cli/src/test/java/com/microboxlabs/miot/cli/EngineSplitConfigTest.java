package com.microboxlabs.miot.cli;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import io.smallrye.config.EnvConfigSource;
import io.smallrye.config.PropertiesConfigSource;
import io.smallrye.config.SmallRyeConfig;
import io.smallrye.config.SmallRyeConfigBuilder;
import java.io.IOException;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * The switches application.properties resolves for the two pods of docs/deployment.md (miot-symptoms): the API pod
 * and the symptom engine. Reads the real file with only the environment of each pod, no profile.
 */
class EngineSplitConfigTest {

    /** The API pod: every component, the engine's consumers and timers off, device events on. */
    static final Map<String, String> API_POD = Map.of(
            "MIOT_COMPONENT_ALL_ENABLED", "true",
            "MIOT_SYMPTOMS_CDC_ENABLED", "false",
            "HOSTNAME", "miot-modulith-0");

    /** The symptom engine: only the symptoms component, no API, event capture on for the rules. */
    static final Map<String, String> ENGINE_POD = Map.of(
            "MIOT_COMPONENT_ALL_ENABLED", "false",
            "MIOT_COMPONENT_SYMPTOMS_ENABLED", "true",
            "MIOT_API_ENABLED", "false",
            "MIOT_CONVERSATIONAL_RULES_EVENTS_ENABLED", "true",
            "HOSTNAME", "miot-symptoms-engine-a");

    @Test
    void theApiPodTakesDeviceEventsWithTheEngineOff() throws IOException {
        SmallRyeConfig c = config(API_POD);

        on(c, "mp.messaging.outgoing.device-signals.enabled");
        off(c, "miot.symptoms.cdc.enabled", "mp.messaging.incoming.symptoms-cdc.enabled",
                "miot.symptoms.signal-builder.enabled", "mp.messaging.incoming.gps-frames.enabled",
                "mp.messaging.outgoing.gps-signals.enabled", "mp.messaging.incoming.signal-asset-client-map.enabled",
                "miot.symptoms.evaluator.enabled", "mp.messaging.incoming.gps-signals-in.enabled",
                "miot.symptoms.sla.enabled");
    }

    @Test
    void theApiPodKeepsTheApiAndEveryComponentJob() throws IOException {
        SmallRyeConfig c = config(API_POD);

        on(c, "miot.api.enabled", "miot.flyway.enabled", "miot.content.cleanup.enabled",
                "miot.iam.native-migration.enabled", "miot.integrations.modulith-worker.enabled",
                "miot.integrations.job-events.live.enabled", "miot.integrations.telephony.reconcile.enabled",
                "miot.harness-threads.purge.enabled", "miot.conversational.rules.enabled",
                "miot.conversational.rules.events.enabled", "miot.conversational.send-jobs.reconcile.enabled",
                "miot.trips.geofences.enabled", "mp.messaging.incoming.trip-gps-signals.enabled",
                "miot.trips.monitors.clock.enabled", "miot.trips.board-events.enabled",
                "miot.symptoms.driver-sync.enabled");
    }

    @Test
    void theEngineRunsTheConsumersAndTimers() throws IOException {
        SmallRyeConfig c = config(ENGINE_POD);

        on(c, "miot.component.symptoms.enabled", "miot.symptoms.cdc.enabled",
                "mp.messaging.incoming.symptoms-cdc.enabled", "miot.symptoms.signal-builder.enabled",
                "mp.messaging.incoming.gps-frames.enabled", "mp.messaging.outgoing.gps-signals.enabled",
                "mp.messaging.incoming.signal-asset-client-map.enabled", "miot.symptoms.evaluator.enabled",
                "mp.messaging.incoming.gps-signals-in.enabled", "miot.symptoms.sla.enabled",
                "miot.conversational.rules.events.enabled", "miot.flyway.enabled");
    }

    @Test
    void theEngineRunsNoJobOfAnotherComponentAndServesNoApi() throws IOException {
        SmallRyeConfig c = config(ENGINE_POD);

        off(c, "miot.component.fleet.enabled", "miot.component.trips.enabled",
                "miot.component.integrations.enabled", "miot.component.conversational.enabled",
                "miot.api.enabled", "miot.content.cleanup.enabled", "miot.iam.native-migration.enabled",
                "miot.integrations.modulith-worker.enabled", "miot.integrations.job-events.live.enabled",
                "miot.integrations.telephony.reconcile.enabled", "miot.harness-threads.purge.enabled",
                "miot.conversational.rules.enabled", "miot.conversational.send-jobs.reconcile.enabled",
                "miot.trips.geofences.enabled", "mp.messaging.incoming.trip-gps-signals.enabled",
                "miot.trips.monitors.clock.enabled", "miot.trips.board-events.enabled",
                "miot.symptoms.driver-sync.enabled", "miot.integrations.retransmit.worker.enabled",
                "miot.places.sync.enabled");
    }

    @Test
    void placesSyncRequiresExplicitOptInEvenOnTheAllComponentsApiPod() throws IOException {
        off(config(API_POD), "miot.places.sync.enabled");
        on(config(Map.of("MIOT_COMPONENT_PLACES_ENABLED", "true", "MIOT_PLACES_SYNC_ENABLED", "true")),
                "miot.component.places.enabled", "miot.places.sync.enabled");
    }

    @Test
    void consumersShareTheirSubscriptionAcrossReplicas() throws IOException {
        SmallRyeConfig a = config(ENGINE_POD);
        SmallRyeConfig b = config(Map.of("MIOT_COMPONENT_SYMPTOMS_ENABLED", "true", "HOSTNAME", "engine-b"));

        for (String channel : new String[] {"gps-frames", "gps-signals-in"}) {
            String prefix = "mp.messaging.incoming." + channel + ".";
            assertEquals("Key_Shared", a.getValue(prefix + "subscriptionType", String.class), channel);
            assertEquals(a.getValue(prefix + "subscriptionName", String.class),
                    b.getValue(prefix + "subscriptionName", String.class), channel);
        }
        assertEquals("Shared", a.getValue("mp.messaging.incoming.symptoms-cdc.subscriptionType", String.class));
    }

    @Test
    void producersAndExclusiveSubscriptionsAreNamedPerReplica() throws IOException {
        SmallRyeConfig a = config(ENGINE_POD);
        SmallRyeConfig b = config(Map.of("MIOT_COMPONENT_SYMPTOMS_ENABLED", "true", "HOSTNAME", "engine-b"));

        for (String producer : new String[] {"gps-signals", "device-signals"}) {
            String key = "mp.messaging.outgoing." + producer + ".producerName";
            assertNotEquals(a.getValue(key, String.class), b.getValue(key, String.class), producer);
        }
        String refs = "mp.messaging.incoming.signal-asset-client-map.";
        assertEquals("Exclusive", a.getValue(refs + "subscriptionType", String.class));
        assertEquals("NonDurable", a.getValue(refs + "subscriptionMode", String.class));
        assertNotEquals(a.getValue(refs + "subscriptionName", String.class),
                b.getValue(refs + "subscriptionName", String.class));
    }

    private static void on(SmallRyeConfig c, String... keys) {
        for (String key : keys) {
            assertEquals(Boolean.TRUE, c.getValue(key, Boolean.class), key);
        }
    }

    private static void off(SmallRyeConfig c, String... keys) {
        for (String key : keys) {
            assertEquals(Boolean.FALSE, c.getValue(key, Boolean.class), key);
        }
    }

    /** The modulith's application.properties under this environment; {@code quarkus.uuid} differs per call. */
    private static SmallRyeConfig config(Map<String, String> env) throws IOException {
        return new SmallRyeConfigBuilder()
                .addDefaultInterceptors()
                .withSources(new PropertiesConfigSource(
                        Path.of("src/main/resources/application.properties").toUri().toURL(), 250))
                .withSources(new EnvConfigSource(env, 300))
                .withDefaultValue("quarkus.uuid", java.util.UUID.randomUUID().toString())
                .build();
    }
}
