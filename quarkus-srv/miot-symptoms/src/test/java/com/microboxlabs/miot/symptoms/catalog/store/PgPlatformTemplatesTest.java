package com.microboxlabs.miot.symptoms.catalog.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import com.microboxlabs.miot.symptoms.catalog.service.InMemoryCatalog;
import com.microboxlabs.miot.symptoms.catalog.service.SpecValidator;
import com.microboxlabs.miot.symptoms.signal.SignalSamples;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * Applies every symptoms migration in version order, as Flyway does on a new database, and checks where the
 * platform's templates end up. Skipped unless {@code -Dmiot.symptoms.test.pg-url} is set; drops and re-creates
 * the {@code miot_symptoms} schema, so use a scratch database.
 */
@EnabledIfSystemProperty(named = PgCatalogStoresTest.URL_PROPERTY, matches = ".+")
class PgPlatformTemplatesTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final List<String> MIGRATIONS = List.of(
            "V0.8.0__create_symptoms_catalog.sql", "V0.8.1__create_control_tower_treatments.sql",
            "V0.8.2__extend_contacts.sql", "V0.8.3__create_tower_settings.sql", "V0.8.4__create_signal_transitions.sql",
            "V0.8.5__signal_cases.sql", "V0.9.2__rule_vocabulary_en.sql", "V0.9.3__platform_symptom_templates.sql",
            "V0.9.4__signal_without_gps_part.sql", "V0.9.5__panic_rule_optional_read.sql", "V0.9.7__sla_expiry.sql",
            "V0.12.0__platform_tenant.sql", "V0.12.1__contact_company_rut.sql",
            "V0.12.2__contact_company_tax_id_type.sql", "V0.12.3__contact_member_unique.sql",
            "V0.12.4__signal_loss_template_reads_detector.sql", "V0.12.5__signal_loss_template_coverage_cohort.sql",
            "V0.12.6__gps_sabotage_template.sql", "V0.12.7__platform_templates_tenant.sql",
            "V0.12.8__coverage_days.sql", "V0.12.10__transition_context.sql",
            "V0.12.11__signal_loss_close_level_one.sql", "V0.12.12__contact_sync.sql",
            "V0.12.13__held_transitions.sql", "V0.12.14__ignore_reasons_move_wrong_map.sql",
            "V0.12.15__noted_transitions.sql");

    private static Vertx vertx;
    private static Pool pool;

    @BeforeAll
    static void migrate() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty(PgCatalogStoresTest.URL_PROPERTY)))
                .using(vertx).build();
        pool.query("DROP SCHEMA IF EXISTS miot_symptoms CASCADE").execute().await().atMost(WAIT);
        for (String file : MIGRATIONS) {
            try (InputStream in = PgPlatformTemplatesTest.class.getResourceAsStream("/db/migration/symptoms/" + file)) {
                pool.query(new String(in.readAllBytes(), StandardCharsets.UTF_8)).execute().await().atMost(WAIT);
            }
        }
    }

    @AfterAll
    static void close() {
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    @Test
    void theTemplatesLiveUnderThePlatformTenant() {
        assertEquals(List.of(), rows("SELECT symptom_key FROM miot_symptoms.symptom_definition"
                + " WHERE tenant_code = 'platform' UNION ALL SELECT version FROM miot_symptoms.symptom_version"
                + " WHERE tenant_code = 'platform'"));
        assertEquals(List.of("1.0.0"), rows("SELECT d.current_version FROM miot_symptoms.symptom_definition d"
                + " WHERE d.tenant_code = '_platform' AND d.symptom_key = 'gps-sabotage'"));
    }

    @Test
    void everyCurrentPublishedPlatformTemplateStillPassesTheRuleChecks() throws IOException {
        DataSourceService sources = new DataSourceService(new InMemoryCatalog(), SignalSamples.inMemory());
        ObjectMapper json = new ObjectMapper();
        for (Row row : pool.query("""
                SELECT d.symptom_key, v.spec::text AS spec FROM miot_symptoms.symptom_definition d
                JOIN miot_symptoms.symptom_version v ON v.definition_id = d.id AND v.version = d.current_version
                WHERE d.tenant_code = '_platform' AND v.status = 'PUBLISHED'
                """).execute().await().atMost(WAIT)) {
            SymptomSpec spec = json.readValue(row.getString("spec"), SymptomSpec.class);
            var report = SpecValidator.validate(spec, sources.get("_platform", spec.source()));
            assertTrue(report.publishable(), row.getString("symptom_key") + ": " + report.findings());
        }
    }

    @Test
    void theLostSignalTemplateIsAtItsLatestVersion() {
        assertEquals(List.of("2.2.0"), rows("SELECT current_version FROM miot_symptoms.symptom_definition"
                + " WHERE tenant_code = '_platform' AND symptom_key = 'signal-loss'"));
        assertEquals(List.of("1.0.0", "2.0.0", "2.1.0", "2.2.0"), rows("SELECT v.version"
                + " FROM miot_symptoms.symptom_version v JOIN miot_symptoms.symptom_definition d ON d.id = v.definition_id"
                + " WHERE d.tenant_code = '_platform' AND d.symptom_key = 'signal-loss' AND v.status = 'PUBLISHED'"
                + " ORDER BY v.version"));
        assertEquals(List.of("check.trip.active && check.loss.ratio >= 1 && !check.loss.returned"),
                rows(spec("2.1.0", "->> 'activation'")));
        assertEquals(List.of("case.closed_by_operator || (case.level <= 1 && case.normal_s >= 0)"),
                rows(spec("2.2.0", "-> 'lifecycle' ->> 'close'")));
        // Only the close rule changes.
        assertEquals(List.of("true"), rows("SELECT ((a.spec #- '{lifecycle,close}')"
                + " = (b.spec #- '{lifecycle,close}'))::text"
                + " FROM miot_symptoms.symptom_version a, miot_symptoms.symptom_version b"
                + " WHERE a.tenant_code = '_platform' AND b.tenant_code = '_platform'"
                + " AND a.version = '2.1.0' AND b.version = '2.2.0' AND a.definition_id = b.definition_id"));
    }

    /** {@code path} of one signal-loss version's spec, such as {@code ->> 'activation'}. */
    private static String spec(String version, String path) {
        return "SELECT v.spec " + path
                + " FROM miot_symptoms.symptom_version v JOIN miot_symptoms.symptom_definition d"
                + " ON d.id = v.definition_id WHERE d.tenant_code = '_platform' AND d.symptom_key = 'signal-loss'"
                + " AND v.version = '" + version + "'";
    }

    private static List<String> rows(String sql) {
        List<String> out = new ArrayList<>();
        for (Row r : pool.query(sql).execute().await().atMost(WAIT)) {
            out.add(r.getString(0));
        }
        return out;
    }
}
