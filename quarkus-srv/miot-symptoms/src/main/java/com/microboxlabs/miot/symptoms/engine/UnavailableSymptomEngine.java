package com.microboxlabs.miot.symptoms.engine;

import java.util.List;

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
}
