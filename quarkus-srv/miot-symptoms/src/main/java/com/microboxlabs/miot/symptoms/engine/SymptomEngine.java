package com.microboxlabs.miot.symptoms.engine;

import java.util.List;

/** Read access to the GPS database's rule engine, so its rules can be imported as symptoms. */
public interface SymptomEngine {

    /** Whether this engine is connected, so callers can say so instead of showing empty data. */
    boolean available();

    /** The rules the engine runs for the organization. */
    List<EngineRule> rules(String tenantCode);
}
