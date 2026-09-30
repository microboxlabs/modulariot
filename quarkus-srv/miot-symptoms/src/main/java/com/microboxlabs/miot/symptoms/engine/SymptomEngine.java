package com.microboxlabs.miot.symptoms.engine;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * Read access to the engine that evaluates symptoms. Today that is the GPS
 * database's rules and {@code process_symptoms_*} functions; a later
 * implementation can evaluate the modulith's own versions instead, behind
 * this same interface.
 */
public interface SymptomEngine {

    /** Whether this engine is connected, so callers can say so instead of showing empty data. */
    boolean available();

    /** The rules the engine runs for the organization. */
    List<EngineRule> rules(String tenantCode);

    /** Cases per symptom name and ICU level that started in {@code [from, to)}, excluded cases left out. */
    List<LevelCount> levelCounts(String tenantCode, OffsetDateTime from, OffsetDateTime to);

    /** The newest cases of one symptom, at most {@code limit}. */
    List<EngineCase> recentCases(String tenantCode, String symptomName, int limit);

    /**
     * Recent objects shaped like the {@code gps_signal} source, for previewing
     * rules. They carry no plate, driver or device identifiers.
     */
    List<Map<String, Object>> signalSamples(String tenantCode, int limit);
}
