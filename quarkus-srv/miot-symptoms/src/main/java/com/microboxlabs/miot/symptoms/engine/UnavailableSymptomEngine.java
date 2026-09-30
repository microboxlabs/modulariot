package com.microboxlabs.miot.symptoms.engine;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/** Used when no engine is configured: reports itself unavailable and returns nothing. */
public class UnavailableSymptomEngine implements SymptomEngine {

    @Override
    public boolean available() {
        return false;
    }

    @Override
    public List<EngineRule> rules(String tenantCode) {
        return List.of();
    }

    @Override
    public List<LevelCount> levelCounts(String tenantCode, OffsetDateTime from, OffsetDateTime to) {
        return List.of();
    }

    @Override
    public List<EngineCase> recentCases(String tenantCode, String symptomName, OffsetDateTime since, int limit) {
        return List.of();
    }

    @Override
    public List<Map<String, Object>> signalSamples(String tenantCode, int limit) {
        return List.of();
    }
}
