package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import com.microboxlabs.miot.symptoms.catalog.service.InMemoryCatalog;
import com.microboxlabs.miot.symptoms.catalog.service.SeedTemplates;
import com.microboxlabs.miot.symptoms.catalog.service.SpecValidator;
import com.microboxlabs.miot.symptoms.catalog.service.Specs;
import com.microboxlabs.miot.symptoms.evaluator.SignalEvaluator.Result;
import com.microboxlabs.miot.symptoms.evaluator.Transition.Kind;
import com.microboxlabs.miot.symptoms.signal.SignalSamples;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/**
 * The operator conditions of V0.12.29: a case goes to the operators on a trip of type v or without a trip type,
 * and stays out of the tray on other types.
 */
class OperatorTripTypeTest {

    static final String MIGRATION = "/db/migration/symptoms/V0.12.29__operator_only_trip_type_v.sql";
    private static final String TENANT = "tenant-a";
    private static final Instant T0 = Instant.parse("2026-10-03T03:00:00Z");
    private static final DataSourceService SOURCES = new DataSourceService(new InMemoryCatalog(),
            SignalSamples.inMemory());

    /** The condition the migration sets for {@code sourceKey}, read from the file. */
    static String rule(String sourceKey) {
        try (InputStream in = OperatorTripTypeTest.class.getResourceAsStream(MIGRATION)) {
            String sql = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            Matcher m = Pattern.compile("\\('" + sourceKey + "', '([^']+)'\\)").matcher(sql);
            assertTrue(m.find(), "no condition for " + sourceKey);
            return m.group(1);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    /** {@code base} with {@code when} on every operator level. */
    private static CompiledSymptom compile(SymptomSpec base, String when, DataSource source) {
        List<SymptomSpec.Level> levels = new ArrayList<>();
        for (SymptomSpec.Level l : base.levels()) {
            boolean operator = l.response() != null && l.response().operator();
            levels.add(operator ? new SymptomSpec.Level(l.icu(), l.applies(), l.when(),
                    l.response().withOperatorWhen(when), l.ignore()) : l);
        }
        SymptomSpec spec = Specs.withLevels(base, levels);
        var report = SpecValidator.validate(spec, source);
        assertTrue(report.publishable(), report.findings().toString());
        return CompiledSymptom.compile(UUID.randomUUID(), "1.0.1", SymptomState.ACTIVE, spec, source);
    }

    private static Map<String, Object> trip(String type) {
        Map<String, Object> trip = new LinkedHashMap<>();
        trip.put("active", true);
        trip.put("double_driver", false);
        if (type != null) {
            trip.put("type", type);
        }
        return trip;
    }

    /** A heavy truck at 105 km/h on a 90 km/h road: speeding level 3, which has an operator. */
    private static Map<String, Object> signal(Map<String, Object> trip) {
        Map<String, Object> signal = new LinkedHashMap<>();
        if (trip != null) {
            signal.put("trip", trip);
        }
        signal.put("vehicle", Map.of("weight_category", "HEAVY"));
        signal.put("frame", Map.of("gps", Map.of("speed", 105.0)));
        signal.put("road", Map.of("maxspeed_osm", 90.0));
        return Map.of("signal", signal);
    }

    /** A lost-signal check after 1900 s of silence: signal-loss level 2, which has an operator. */
    private static Map<String, Object> check(Map<String, Object> trip) {
        Map<String, Object> check = new LinkedHashMap<>();
        if (trip != null) {
            check.put("trip", trip);
        }
        check.put("signal_lost_minutes", 1900 / 60.0);
        check.put("loss", Map.of("silence_s", 1900.0, "expected_s", 180.0, "ratio", 1900 / 180.0,
                "returned", false, "backfill", false, "low_coverage_zone", false, "cohort_outage", false,
                "nearby_reporting", 0.0));
        return Map.of("check", check);
    }

    private static Transition opened(CompiledSymptom s, Map<String, Object> root) {
        Result r = new SignalEvaluator(new InMemoryEpisodeStore()).evaluate(TENANT, "truck-1", T0, root, List.of(s));
        assertTrue(r.errors().isEmpty(), r.errors().toString());
        assertEquals(Kind.OPENED, r.transitions().getFirst().kind());
        return r.transitions().getFirst();
    }

    @Test
    void gpsSignalCasesGoToTheOperatorsOnTripsOfTypeVOrWithoutType() {
        DataSource source = SOURCES.get(TENANT, "gps_signal");
        CompiledSymptom s = compile(Specs.speeding(), rule("gps_signal"), source);

        assertEquals("signal.?trip.?type.orValue(\"v\") == \"v\"", rule("gps_signal"));
        assertEquals(3, opened(s, signal(trip("v"))).level());
        assertEquals(Boolean.TRUE, opened(s, signal(trip("v"))).operator());
        assertEquals(Boolean.FALSE, opened(s, signal(trip("ote"))).operator(), "recorded, out of the tray");
        assertEquals(Boolean.FALSE, opened(s, signal(trip("otr"))).operator());
        assertEquals(Boolean.TRUE, opened(s, signal(trip(null))).operator(), "a trip without type");
    }

    @Test
    void gpsSignalCasesWithoutATripGoToTheOperators() {
        DataSource source = SOURCES.get(TENANT, "gps_signal");
        CompiledSymptom s = compile(Specs.with(Specs.speeding(), "signal.vehicle.weight_category == \"HEAVY\""),
                rule("gps_signal"), source);

        assertEquals(Boolean.TRUE, opened(s, signal(null)).operator());
    }

    @Test
    void tripCheckCasesGoToTheOperatorsOnTripsOfTypeVOrWithoutType() {
        DataSource source = SOURCES.get(TENANT, "trip_check");
        CompiledSymptom s = compile(SeedTemplates.get("signal-loss").spec(), rule("trip_check"), source);

        assertEquals("check.?trip.?type.orValue(\"v\") == \"v\"", rule("trip_check"));
        assertEquals(2, opened(s, check(trip("v"))).level());
        assertEquals(Boolean.TRUE, opened(s, check(trip("v"))).operator());
        assertEquals(Boolean.FALSE, opened(s, check(trip("ote"))).operator(), "recorded, out of the tray");
        assertEquals(Boolean.TRUE, opened(s, check(trip(null))).operator(), "a trip without type");
    }

    @Test
    void theConditionRunsWithoutErrorWhenTheTripIsMissing() {
        CompiledSymptom gps = compile(Specs.speeding(), rule("gps_signal"), SOURCES.get(TENANT, "gps_signal"));
        CompiledSymptom loss = compile(SeedTemplates.get("signal-loss").spec(), rule("trip_check"),
                SOURCES.get(TENANT, "trip_check"));
        List<SignalEvaluator.RuleError> errors = new ArrayList<>();

        assertTrue(SignalEvaluator.operator(gps, 3, Map.of("signal", Map.of()), errors));
        assertTrue(SignalEvaluator.operator(loss, 2, Map.of("check", Map.of()), errors));
        assertTrue(errors.isEmpty(), errors.toString());
    }
}
