package com.microboxlabs.miot.symptoms.catalog.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.FieldOrigin;
import com.microboxlabs.miot.symptoms.catalog.domain.RuleDescription;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceField;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceKind;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomDefinition;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomVersion;
import com.microboxlabs.miot.symptoms.catalog.domain.VersionBump;
import com.microboxlabs.miot.symptoms.catalog.domain.VersionStatus;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * Runs the Postgres stores against a real database. Skipped unless
 * {@code -Dmiot.symptoms.test.pg-url=postgresql://user:password@host:port/db}
 * is set; the database's {@code miot_symptoms} schema is dropped and
 * re-created, so use a scratch database.
 */
@EnabledIfSystemProperty(named = PgCatalogStoresTest.URL_PROPERTY, matches = ".+")
class PgCatalogStoresTest {

    static final String URL_PROPERTY = "miot.symptoms.test.pg-url";
    private static final String TENANT = "tenant-a";
    private static final Duration WAIT = Duration.ofSeconds(10);

    private static Vertx vertx;
    private static Pool pool;

    @BeforeAll
    static void migrate() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty(URL_PROPERTY)))
                .using(vertx).build();
        String migration;
        try (InputStream in = PgCatalogStoresTest.class
                .getResourceAsStream("/db/migration/symptoms/V0.8.0__create_symptoms_catalog.sql")) {
            migration = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
        pool.query("DROP SCHEMA IF EXISTS miot_symptoms CASCADE").execute().await().atMost(WAIT);
        pool.query(migration).execute().await().atMost(WAIT);
    }

    @AfterAll
    static void close() {
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    @Test
    void draftPublishAndRollbackRoundTrip() {
        PgSymptomCatalogStore store = new PgSymptomCatalogStore(() -> pool);
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MILLIS);
        SymptomDefinition created = store.insertDefinition(new SymptomDefinition(UUID.randomUUID(), TENANT,
                "speeding", "Exceso de velocidad", "driving_safety", "speed", null, "gps_signal", 9, null, null,
                SymptomState.OFF, null, "owner@example.com", now, "owner@example.com", now));

        SymptomSpec spec = new SymptomSpec("gps_signal", "signal.trip.active == true",
                new SymptomSpec.Measure("signal.gps.speed_kmh - signal.road.maxspeed_osm", "Exceso", "km/h"),
                List.of(), new SymptomSpec.Lifecycle("caso.condicion_s >= 0", "caso.normal_s >= 120"), null);
        SymptomVersion draft = store.saveDraft(SymptomVersion.draft(created.id(), TENANT, spec, "owner@example.com",
                now));
        SymptomVersion edited = store.saveDraft(SymptomVersion.draft(created.id(), TENANT,
                new SymptomSpec("gps_signal", "signal.trip.active", spec.measure(), List.of(), spec.lifecycle(), null),
                "owner@example.com", now));
        assertEquals(draft.id(), edited.id(), "saving again replaces the one draft");
        assertEquals("signal.trip.active", edited.spec().activation());

        SymptomVersion v1 = store.publish(edited.published("1.0.0", VersionBump.MAJOR, "Primera versión", null,
                "owner@example.com", now), created.withCurrent("1.0.0", SymptomState.ACTIVE, "owner@example.com", now));
        assertEquals(VersionStatus.PUBLISHED, v1.status());
        assertTrue(store.findDraft(TENANT, created.id()).isEmpty());
        assertEquals("1.0.0", store.findDefinition(TENANT, created.id()).orElseThrow().currentVersion());

        SymptomVersion rollback = SymptomVersion.draft(created.id(), TENANT, spec, "owner@example.com", now)
                .published("1.1.0", VersionBump.MINOR, "Volver", "1.0.0", "owner@example.com", now);
        store.publish(rollback, created.withCurrent("1.1.0", SymptomState.ACTIVE, "owner@example.com", now));

        List<String> numbers = store.listVersions(TENANT, created.id()).stream().map(SymptomVersion::version)
                .toList();
        assertTrue(numbers.containsAll(List.of("1.0.0", "1.1.0")));
        assertEquals("1.0.0", store.findVersion(TENANT, created.id(), "1.1.0").orElseThrow().rolledBackFrom());
        assertTrue(store.findDefinition("tenant-b", created.id()).isEmpty(), "other tenants see nothing");
        assertTrue(!store.definitionsWithDraft(TENANT).contains(created.id()), "publishing consumed the draft");
        assertEquals(List.of("1.1.0"), store.currentVersions(TENANT).stream()
                .filter(v -> v.definitionId().equals(created.id())).map(SymptomVersion::version).toList());
        assertTrue(store.currentVersions("tenant-b").isEmpty());
    }

    @Test
    void publishedVersionsAreNeverRewrittenAndDraftsStayInTheirTenant() {
        PgSymptomCatalogStore store = new PgSymptomCatalogStore(() -> pool);
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MILLIS);
        SymptomDefinition created = store.insertDefinition(new SymptomDefinition(UUID.randomUUID(), TENANT,
                "lost-signal", "Pérdida de señal", null, null, null, "trip_check", null, null, null,
                SymptomState.OFF, null, "owner@example.com", now, "owner@example.com", now));
        SymptomSpec spec = new SymptomSpec("trip_check", "true", null, List.of(), null, null);
        SymptomVersion draft = store.saveDraft(SymptomVersion.draft(created.id(), TENANT, spec, "owner@example.com",
                now));
        SymptomDefinition current = created.withCurrent("1.0.0", SymptomState.ACTIVE, "owner@example.com", now);
        store.publish(draft.published("1.0.0", VersionBump.MAJOR, "Primera", null, "owner@example.com", now), current);

        SymptomVersion again = draft.published("9.9.9", VersionBump.MAJOR, "Otra vez", null, "owner@example.com", now);
        assertThrows(IllegalStateException.class, () -> store.publish(again, current));
        assertEquals("1.0.0", store.listVersions(TENANT, created.id()).get(0).version());

        store.saveDraft(SymptomVersion.draft(created.id(), TENANT, spec, "owner@example.com", now));
        SymptomVersion foreign = SymptomVersion.draft(created.id(), "tenant-b", spec, "intruder@example.com", now);
        assertThrows(RuntimeException.class, () -> store.saveDraft(foreign));
        assertEquals("owner@example.com", store.findDraft(TENANT, created.id()).orElseThrow().createdBy());
    }

    @Test
    void tenantSourceReplacesPlatformSourceWithTheSameKey() {
        PgDataSourceStore store = new PgDataSourceStore(() -> pool);
        SourceField speed = new SourceField("signal.gps.speed_kmh", "Velocidad", "number", "km/h",
                FieldOrigin.DEVICE, true);
        store.upsert(new DataSource(UUID.randomUUID(), null, "gps_signal", "Señal GPS", SourceKind.SIGNAL, "signal",
                "Cada pulso", List.of(speed), List.of(Map.of("signal", Map.of("gps", Map.of("speed_kmh", 80))))));
        store.upsert(new DataSource(UUID.randomUUID(), TENANT, "gps_signal", "Señal GPS propia", SourceKind.SIGNAL,
                "signal", null, List.of(speed), List.of()));

        assertEquals("Señal GPS propia", store.find(TENANT, "gps_signal").orElseThrow().name());
        DataSource platform = store.find("tenant-b", "gps_signal").orElseThrow();
        assertNull(platform.tenantCode());
        assertEquals(FieldOrigin.DEVICE, platform.fields().get(0).origin());
        assertEquals(1, platform.samples().size());
    }

    @Test
    void descriptionIsStoredByRuleHash() {
        PgRuleDescriptionStore store = new PgRuleDescriptionStore(() -> pool);
        store.save(new RuleDescription("abc", "es-CL", "owner", "<b>Se abre</b> al instante"));
        store.save(new RuleDescription("abc", "es-CL", "owner", "<b>Se abre</b> de inmediato"));

        assertEquals("<b>Se abre</b> de inmediato", store.find("abc", "es-CL", "owner").orElseThrow().html());
        assertTrue(store.find("abc", "en", "owner").isEmpty());

        store.save(new RuleDescription("def", "es-CL", "owner", "otra"));
        store.save(new RuleDescription("def", "en", "owner", "other"));
        assertEquals(Set.of("abc", "def"),
                store.findAll(List.of("abc", "def", "nope"), "es-CL", "owner").keySet());
        assertEquals("other", store.findAll(List.of("def"), "en", "owner").get("def").html());
        assertTrue(store.findAll(List.of(), "es-CL", "owner").isEmpty());
    }
}
