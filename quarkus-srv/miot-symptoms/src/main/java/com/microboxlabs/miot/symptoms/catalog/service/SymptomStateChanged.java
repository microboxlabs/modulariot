package com.microboxlabs.miot.symptoms.catalog.service;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import java.util.UUID;

/** A symptom moved between OFF, TEST and ACTIVE, by a state change or a publish. Fired after it is saved. */
public record SymptomStateChanged(String tenantCode, UUID definitionId, SymptomState from, SymptomState to) {
}
