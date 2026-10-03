package com.microboxlabs.miot.symptoms.engine;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * A fixed engine for local runs and demos: one speeding rule, counts at a
 * fixed weekly rate, five cases and three signal samples. Every organization sees the same data.
 */
public class DemoSymptomEngine implements SymptomEngine {

    static final String SPEEDING = "Speed Limit Standard";

    @Override
    public boolean available() {
        return true;
    }

    @Override
    public List<EngineRule> rules(String tenantCode) {
        return List.of(new EngineRule(9, SPEEDING, "signal",
                Map.of("in_trip", 1, "cooldown_seconds", 120, "maxspeed_infraction_osm", 1), true,
                List.of("Invalidated"), false));
    }

    @Override
    public List<LevelCount> levelCounts(String tenantCode, OffsetDateTime from, OffsetDateTime to) {
        double weeks = Math.max(0, Duration.between(from, to).toMinutes()) / (7.0 * 24 * 60);
        return List.of(new LevelCount(SPEEDING, 2, Math.round(412 * weeks)),
                new LevelCount(SPEEDING, 3, Math.round(131 * weeks)),
                new LevelCount(SPEEDING, 4, Math.round(38 * weeks)));
    }

    @Override
    public List<EngineCase> recentCases(String tenantCode, String symptomName, OffsetDateTime since, int limit) {
        if (!SPEEDING.equals(symptomName)) {
            return List.of();
        }
        OffsetDateTime start = OffsetDateTime.of(2026, 9, 29, 14, 0, 0, 0, ZoneOffset.UTC);
        List<EngineCase> out = new ArrayList<>();
        int[] icu = {4, 3, 2, 3, 2};
        double[] excess = {24, 13, 7, 12, 6};
        for (int i = 0; i < Math.min(limit, icu.length); i++) {
            OffsetDateTime first = start.minusMinutes(37L * i);
            if (first.isBefore(since)) {
                break;
            }
            out.add(new EngineCase(1000L + i, SPEEDING, icu[i], "demo-trip-" + (i + 1), first, first.plusSeconds(95),
                    BigDecimal.valueOf(excess[i]), i == 0, false));
        }
        return out;
    }

    @Override
    public List<EngineCase> casesPage(String tenantCode, String symptomName, OffsetDateTime from, OffsetDateTime to,
            List<Integer> icus, long afterId, int limit) {
        return recentCases(tenantCode, symptomName, from, Integer.MAX_VALUE).stream()
                .filter(c -> c.firstSignalAt().isBefore(to) && icus.contains(c.icu()) && !c.excluded())
                .filter(c -> c.id() > afterId)
                .sorted(Comparator.comparingLong(EngineCase::id))
                .limit(limit)
                .toList();
    }

    @Override
    public List<Map<String, Object>> signalSamples(String tenantCode, int limit) {
        List<Map<String, Object>> samples = List.of(
                GpsSymptomEngine.signalSample(112.0, 90.0, "HEAVY", 28000.0, "0", 75),
                GpsSymptomEngine.signalSample(101.0, 90.0, "HEAVY", 28000.0, "0", 20),
                GpsSymptomEngine.signalSample(58.0, 50.0, "LIGHT", 3200.0, "1", 10));
        return samples.subList(0, Math.min(limit, samples.size()));
    }
}
