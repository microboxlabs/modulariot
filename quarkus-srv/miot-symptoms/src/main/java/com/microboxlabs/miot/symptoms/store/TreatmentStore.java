package com.microboxlabs.miot.symptoms.store;

import com.microboxlabs.miot.symptoms.domain.ContactCallStats;
import com.microboxlabs.miot.symptoms.domain.Treatment;
import com.microboxlabs.miot.symptoms.domain.TreatmentAction;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import java.util.List;
import java.util.Optional;

/**
 * Where treatment episodes and their actions live. Every call is scoped by
 * tenant. The only implementation today is {@link InMemoryTreatmentStore}
 * (demo data); a database-backed one replaces it without touching the
 * services or the HTTP contract.
 */
public interface TreatmentStore {

    /** Stores a new episode. Assigns id and timestamps that are null on the input. */
    Treatment insert(Treatment treatment);

    Optional<Treatment> find(String tenantCode, String id);

    /** The OPEN episode {@code actor} has on the symptom, if any. */
    Optional<Treatment> findOpen(String tenantCode, long symptomId, String actor);

    /** Oldest first. */
    List<Treatment> listBySymptom(String tenantCode, long symptomId);

    /** Moves an OPEN episode to {@code status}; empty when it was not open or not found. */
    Optional<Treatment> transition(
            String tenantCode, String id, TreatmentStatus status, String actor, String resolution, String note);

    /** Appends an action. Assigns id, the next {@code seq}, and {@code performedAt} when null. */
    TreatmentAction addAction(TreatmentAction action);

    /** Actions of the given episodes, grouped by episode and ordered by {@code seq}. */
    List<TreatmentAction> listActions(String tenantCode, List<String> treatmentIds);

    /** Call statistics per tenant contact, derived from CALL actions. */
    List<ContactCallStats> contactStats(String tenantCode);
}
