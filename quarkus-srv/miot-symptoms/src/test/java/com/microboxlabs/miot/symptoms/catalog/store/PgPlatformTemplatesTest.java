package com.microboxlabs.miot.symptoms.catalog.store;

import static org.junit.jupiter.api.Assertions.assertEquals;

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
            "V0.12.6__gps_sabotage_template.sql", "V0.12.7__platform_templates_tenant.sql");

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
    void theLostSignalTemplateIsAtItsLatestVersion() {
        assertEquals(List.of("2.1.0"), rows("SELECT current_version FROM miot_symptoms.symptom_definition"
                + " WHERE tenant_code = '_platform' AND symptom_key = 'signal-loss'"));
        assertEquals(List.of("1.0.0", "2.0.0", "2.1.0"), rows("SELECT v.version FROM miot_symptoms.symptom_version v"
                + " JOIN miot_symptoms.symptom_definition d ON d.id = v.definition_id"
                + " WHERE d.tenant_code = '_platform' AND d.symptom_key = 'signal-loss' AND v.status = 'PUBLISHED'"
                + " ORDER BY v.version"));
        assertEquals(List.of("check.trip.active && check.loss.ratio >= 1 && !check.loss.returned"),
                rows("SELECT v.spec ->> 'activation' FROM miot_symptoms.symptom_version v"
                        + " JOIN miot_symptoms.symptom_definition d ON d.id = v.definition_id"
                        + " WHERE d.tenant_code = '_platform' AND d.symptom_key = 'signal-loss' AND v.version = '2.1.0'"));
    }

    private static List<String> rows(String sql) {
        List<String> out = new ArrayList<>();
        for (Row r : pool.query(sql).execute().await().atMost(WAIT)) {
            out.add(r.getString(0));
        }
        return out;
    }
}
