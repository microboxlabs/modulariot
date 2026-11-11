package com.microboxlabs.miot.symptoms.catalog.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import com.microboxlabs.miot.symptoms.catalog.service.InMemoryCatalog;
import com.microboxlabs.miot.symptoms.catalog.service.SpecValidator;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleResult;
import com.microboxlabs.miot.symptoms.evaluator.CompiledSymptom;
import com.microboxlabs.miot.symptoms.signal.SignalSamples;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.io.InputStream;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * V0.12.29 on a database with every earlier symptoms migration and some organization symptoms: each operator level
 * of a gps_signal or trip_check version in force gets the trip-type condition in a new PATCH version. Skipped
 * unless {@code -Dmiot.symptoms.test.pg-url} is set; drops and re-creates the {@code miot_symptoms} schema, so use
 * a scratch database.
 */
@EnabledIfSystemProperty(named = PgCatalogStoresTest.URL_PROPERTY, matches = ".+")
class PgOperatorTripTypeTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final String DIR = "/db/migration/symptoms/";
    private static final String MIGRATION = "V0.12.29__operator_only_trip_type_v.sql";
    private static final String TENANT = "tenant-demo-trip-type";
    private static final String GPS_RULE = "signal.?trip.?type.orValue(\"v\") == \"v\"";
    private static final String CHECK_RULE = "check.?trip.?type.orValue(\"v\") == \"v\"";
    private static final Map<String, String> RULES = Map.of("gps_signal", GPS_RULE, "trip_check", CHECK_RULE);
    private static final String EXISTING = "signal.trip.code != \"X\"";
    private static final String CURRENT = """
            SELECT d.id::text, d.tenant_code, d.symptom_key, d.source_key, d.current_version,
                   (SELECT count(*) FROM miot_symptoms.symptom_version x WHERE x.definition_id = d.id)::int AS versions,
                   (CASE jsonb_typeof(v.spec) WHEN 'string' THEN (v.spec #>> '{}')::jsonb ELSE v.spec END)::text AS doc,
                   v.bump, v.reason, v.published_by, v.published_at IS NOT NULL AS dated
              FROM miot_symptoms.symptom_definition d
              LEFT JOIN miot_symptoms.symptom_version v ON v.definition_id = d.id AND v.version = d.current_version
                   AND v.status = 'PUBLISHED'
            """;

    private static final DataSourceService SOURCES = new DataSourceService(new InMemoryCatalog(),
            SignalSamples.inMemory());
    private static final ObjectMapper JSON = new ObjectMapper();

    private static Vertx vertx;
    private static Pool pool;
    private static Map<String, Current> before;
    private static Map<String, Current> after;
    private static long audits;

    /** A symptom and its version in force, by {@code tenant/key}. */
    private record Current(String id, String sourceKey, String version, int versions, JsonObject doc, String bump,
            String reason, String publishedBy, boolean dated) {

        String source() {
            String s = doc == null ? null : doc.getString("source");
            return s == null || s.isBlank() ? sourceKey : s;
        }
    }

    @BeforeAll
    static void migrate() throws IOException, URISyntaxException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty(PgCatalogStoresTest.URL_PROPERTY)))
                .using(vertx).build();
        pool.query("DROP SCHEMA IF EXISTS miot_symptoms CASCADE").execute().await().atMost(WAIT);
        for (String file : migrations()) {
            if (file.equals(MIGRATION)) {
                seed();
                before = current();
            }
            run(file);
        }
        after = current();
        audits = pool.query("SELECT count(*) FROM miot_symptoms.audit_event WHERE action = 'symptom.published'"
                + " AND actor = 'platform-seed'").execute().await().atMost(WAIT).iterator().next().getLong(0);
    }

    @AfterAll
    static void close() {
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    /** Every symptoms migration, in Flyway's version order. */
    private static List<String> migrations() throws IOException, URISyntaxException {
        try (Stream<Path> files = Files.list(Path.of(PgOperatorTripTypeTest.class.getResource(DIR).toURI()))) {
            return files.map(p -> p.getFileName().toString()).filter(f -> f.matches("V[0-9.]+__.*\\.sql"))
                    .sorted(Comparator.comparing(PgOperatorTripTypeTest::version, PgOperatorTripTypeTest::compare))
                    .toList();
        }
    }

    private static int[] version(String file) {
        return Arrays.stream(file.substring(1, file.indexOf("__")).split("\\.")).mapToInt(Integer::parseInt)
                .toArray();
    }

    private static int compare(int[] a, int[] b) {
        for (int i = 0; i < Math.max(a.length, b.length); i++) {
            int c = Integer.compare(i < a.length ? a[i] : 0, i < b.length ? b[i] : 0);
            if (c != 0) {
                return c;
            }
        }
        return 0;
    }

    private static void run(String file) throws IOException {
        try (InputStream in = PgOperatorTripTypeTest.class.getResourceAsStream(DIR + file)) {
            pool.query(new String(in.readAllBytes(), StandardCharsets.UTF_8)).execute().await().atMost(WAIT);
        }
    }

    private static JsonObject response(boolean operator, String operatorWhen) {
        JsonObject r = new JsonObject().put("operator", operator).put("slaMinutes", operator ? 15 : null)
                .put("steps", new JsonArray()).put("notices", new JsonArray()).put("evidence", new JsonArray())
                .put("ignorable", true);
        if (operatorWhen != null) {
            r.put("operatorWhen", operatorWhen);
        }
        return r;
    }

    private static JsonObject level(int icu, String when, boolean operator, String operatorWhen) {
        return new JsonObject().put("icu", icu).put("applies", true).put("when", when)
                .put("response", response(operator, operatorWhen));
    }

    /** Four levels on the measure; levels 3 and 4 have an operator, level 3 with {@code threeWhen}. */
    private static JsonObject spec(String source, String root, String threeWhen, String fourWhen) {
        String activation = "gps_signal".equals(source) ? "signal.trip.active && signal.frame.gps.speed > 90.0"
                : "check.trip.active && check.loss.ratio >= 1.0";
        String measure = "gps_signal".equals(source) ? "signal.frame.gps.speed - 90.0" : "check.loss.silence_s / 60.0";
        return new JsonObject().put("source", source).put("activation", activation)
                .put("measure", new JsonObject().put("expression", measure).put("label", "Medida").put("unit", "x"))
                .put("levels", new JsonArray()
                        .add(level(1, "measure < 5.0", false, null))
                        .add(level(2, "measure >= 5.0 && measure < 11.0", false, null))
                        .add(level(3, "measure >= 11.0 && measure < 21.0", true, threeWhen))
                        .add(level(4, "measure >= 21.0", true, fourWhen)))
                .put("lifecycle", new JsonObject().put("open", "case.condition_s >= 0")
                        .put("close", "case.normal_s >= 0").put("levelDown", true).put("after_trip_end", "ignore"))
                .put("family", "speed").put("state", "TEST")
                .put("extra", new JsonObject().put("kept", root));
    }

    private static void definition(String key, String source, String current, Map<String, String> versions,
            boolean encoded) {
        UUID id = UUID.randomUUID();
        pool.preparedQuery("""
                INSERT INTO miot_symptoms.symptom_definition
                    (id, tenant_code, symptom_key, name, source_key, state, current_version, created_by, updated_by)
                VALUES ($1, $2, $3, $3, $4, 'ACTIVE', $5, 'test', 'test')
                """).execute(Tuple.of(id, TENANT, key, source, current)).await().atMost(WAIT);
        versions.forEach((version, spec) -> pool.preparedQuery("""
                INSERT INTO miot_symptoms.symptom_version
                    (definition_id, tenant_code, version, status, spec, bump, reason, created_by, published_by,
                     published_at)
                VALUES ($1, $2, $3, $4, %s, 'MINOR', 'test', 'test', 'test', now())
                """.formatted(encoded ? "to_jsonb($5::text)" : "$5::text::jsonb"))
                .execute(Tuple.of(id, TENANT, version, version == null ? "DRAFT" : "PUBLISHED", spec))
                .await().atMost(WAIT));
    }

    /** Organization symptoms, beside the platform templates the earlier migrations seed. */
    private static void seed() {
        String gps = spec("gps_signal", "a", null, null).encode();
        definition("gps-plain", "gps_signal", "2.3.1",
                Map.of("1.0.0", spec("gps_signal", "old", null, null).encode(), "2.3.1", gps), false);
        definition("gps-and", "gps_signal", "1.0.0",
                Map.of("1.0.0", spec("gps_signal", "b", EXISTING, null).encode()), false);
        definition("gps-encoded", "gps_signal", "1.1.0", Map.of("1.1.0", gps), true);
        definition("check-loss", "trip_check", "2.0.0",
                Map.of("2.0.0", spec("trip_check", "c", null, null).encode()), false);
        JsonObject quiet = spec("gps_signal", "d", null, null);
        quiet.getJsonArray("levels").stream().map(JsonObject.class::cast)
                .forEach(l -> l.getJsonObject("response").put("operator", false));
        definition("gps-no-operator", "gps_signal", "1.0.0", Map.of("1.0.0", quiet.encode()), false);
        definition("gps-already", "gps_signal", "1.0.0",
                Map.of("1.0.0", spec("gps_signal", "e", GPS_RULE, "(" + EXISTING + ") && " + GPS_RULE).encode()),
                false);
        definition("webhook-source", "some_webhook", "1.0.0",
                Map.of("1.0.0", spec("gps_signal", "f", null, null).put("source", "some_webhook").encode()), false);
        Map<String, String> draft = new HashMap<>();
        draft.put(null, gps);
        definition("draft-only", "gps_signal", null, draft, false);
    }

    private static Map<String, Current> current() {
        Map<String, Current> out = new LinkedHashMap<>();
        for (Row r : pool.query(CURRENT).execute().await().atMost(WAIT)) {
            String doc = r.getString("doc");
            out.put(r.getString("tenant_code") + "/" + r.getString("symptom_key"), new Current(r.getString("id"),
                    r.getString("source_key"), r.getString("current_version"), r.getInteger("versions"),
                    doc == null ? null : new JsonObject(doc), r.getString("bump"), r.getString("reason"),
                    r.getString("published_by"), Boolean.TRUE.equals(r.getBoolean("dated"))));
        }
        return out;
    }

    private static boolean operatorLevel(JsonObject level) {
        JsonObject response = level.getJsonObject("response");
        return Boolean.TRUE.equals(level.getBoolean("applies")) && response != null
                && Boolean.TRUE.equals(response.getBoolean("operator"));
    }

    /** Whether the migration has something to add to this version. */
    private static boolean target(Current c) {
        String rule = c.doc == null ? null : RULES.get(c.source());
        if (rule == null || c.doc.getJsonArray("levels") == null) {
            return false;
        }
        return c.doc.getJsonArray("levels").stream().map(JsonObject.class::cast).filter(PgOperatorTripTypeTest::operatorLevel)
                .anyMatch(l -> !l.getJsonObject("response").getString("operatorWhen", "").contains(rule));
    }

    private static String patch(String version) {
        String[] p = version.split("\\.");
        return p[0] + "." + p[1] + "." + (Integer.parseInt(p[2]) + 1);
    }

    @Test
    void everyOperatorLevelInForceNowHasTheConditionAndNothingElseChanged() {
        int changed = 0;
        for (var e : before.entrySet()) {
            Current old = e.getValue();
            Current now = after.get(e.getKey());
            if (!target(old)) {
                continue;
            }
            changed++;
            String rule = RULES.get(old.source());
            assertEquals(patch(old.version()), now.version(), e.getKey());
            assertEquals(old.versions() + 1, now.versions(), e.getKey());
            assertEquals("PATCH", now.bump(), e.getKey());
            assertEquals("Solo los viajes tipo v, o sin tipo, van a la bandeja del operador", now.reason());
            assertEquals("platform-seed", now.publishedBy());
            assertTrue(now.dated(), e.getKey());
            JsonArray oldLevels = old.doc().getJsonArray("levels");
            JsonArray newLevels = now.doc().getJsonArray("levels");
            JsonObject restored = now.doc().copy();
            for (int i = 0; i < newLevels.size(); i++) {
                JsonObject o = oldLevels.getJsonObject(i);
                JsonObject n = newLevels.getJsonObject(i);
                if (!operatorLevel(o)) {
                    assertEquals(o, n, e.getKey() + " level " + o.getInteger("icu") + " has no operator");
                    continue;
                }
                String was = o.getJsonObject("response").getString("operatorWhen");
                String expected = was == null || was.isBlank() ? rule
                        : was.contains(rule) ? was : "(" + was + ") && " + rule;
                assertEquals(expected, n.getJsonObject("response").getString("operatorWhen"),
                        e.getKey() + " level " + o.getInteger("icu"));
                JsonObject r = restored.getJsonArray("levels").getJsonObject(i).getJsonObject("response");
                if (was == null) {
                    r.remove("operatorWhen");
                } else {
                    r.put("operatorWhen", was);
                }
            }
            assertEquals(old.doc(), restored, e.getKey() + ": only operatorWhen changes");
        }
        long platform = before.entrySet().stream().filter(e -> e.getKey().startsWith("_platform/"))
                .filter(e -> target(e.getValue())).count();
        System.out.printf("V0.12.29 publishes %d versions (%d platform templates)%n", changed, platform);
        assertTrue(platform > 0, "platform templates change");
        assertEquals(changed, audits, "one audit entry per version");
    }

    @Test
    void theOrganizationSymptomsAreUpdatedAsExpected() {
        String t = TENANT + "/";
        assertEquals("2.3.2", after.get(t + "gps-plain").version());
        assertEquals("1.1.1", after.get(t + "gps-encoded").version());
        assertEquals("2.0.1", after.get(t + "check-loss").version());
        assertEquals("1.0.1", after.get(t + "gps-and").version());
        assertEquals("a", after.get(t + "gps-plain").doc().getJsonObject("extra").getString("kept"),
                "copied from the version in force, not the older one");
        JsonArray and = after.get(t + "gps-and").doc().getJsonArray("levels");
        assertEquals("(" + EXISTING + ") && " + GPS_RULE, and.getJsonObject(2).getJsonObject("response")
                .getString("operatorWhen"));
        assertEquals(GPS_RULE, and.getJsonObject(3).getJsonObject("response").getString("operatorWhen"));
        assertEquals(CHECK_RULE, after.get(t + "check-loss").doc().getJsonArray("levels").getJsonObject(3)
                .getJsonObject("response").getString("operatorWhen"));
        for (String key : List.of("gps-no-operator", "gps-already", "webhook-source", "draft-only")) {
            assertEquals(before.get(t + key), after.get(t + key), key + " is left as it was");
        }
    }

    @Test
    void runningItAgainChangesNothing() throws IOException {
        run(MIGRATION);
        assertEquals(after, current());
    }

    @Test
    void everyChangedVersionPassesTheChecksAndRoutesByTripType() throws Exception {
        for (var e : after.entrySet()) {
            Current c = e.getValue();
            if (!target(before.get(e.getKey()))) {
                continue;
            }
            SymptomSpec spec = JSON.readValue(c.doc().encode(), SymptomSpec.class);
            var source = SOURCES.get("_platform", c.source());
            var report = SpecValidator.validate(spec.withState(null), source);
            assertTrue(report.publishable(), e.getKey() + ": " + report.findings());
            CompiledSymptom compiled = CompiledSymptom.compile(UUID.fromString(c.id()), c.version(),
                    SymptomState.TEST, spec, source);
            String root = source.root();
            for (SymptomSpec.Level l : spec.levels()) {
                CompiledSymptom.Operator op = compiled.operators().get(l.icu());
                if (op == null || !op.required()) {
                    continue;
                }
                JsonObject old = before.get(e.getKey()).doc().getJsonArray("levels").getJsonObject(l.icu() - 1);
                String code = old.getJsonObject("response").getString("operatorWhen") == null ? null : "Y";
                String where = e.getKey() + " level " + l.icu();
                assertEquals(true, value(op, root, trip("v", code)), where + " type v");
                assertEquals(false, value(op, root, trip("ote", code)), where + " type ote");
                assertEquals(false, value(op, root, trip("otr", code)), where + " type otr");
                if (code == null) {
                    assertEquals(true, value(op, root, trip(null, null)), where + " trip without type");
                    assertEquals(true, value(op, root, null), where + " no trip");
                }
            }
        }
    }

    private static Map<String, Object> trip(String type, String code) {
        Map<String, Object> trip = new LinkedHashMap<>();
        trip.put("active", true);
        if (type != null) {
            trip.put("type", type);
        }
        if (code != null) {
            trip.put("code", code);
        }
        return trip;
    }

    private static Object value(CompiledSymptom.Operator op, String root, Map<String, Object> trip) {
        RuleResult r = op.when().run(Map.of(root, trip == null ? Map.of() : Map.of("trip", trip)));
        assertTrue(r.ok(), r.error());
        return r.value();
    }
}
