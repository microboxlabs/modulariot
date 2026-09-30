package com.microboxlabs.miot.symptoms.store;

import com.microboxlabs.miot.symptoms.domain.ContactCallStats;
import com.microboxlabs.miot.symptoms.domain.Treatment;
import com.microboxlabs.miot.symptoms.domain.TreatmentAction;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Where treatment episodes and their actions live. Every call is scoped by
 * tenant. {@link PgTreatmentStore} is the bean; {@link InMemoryTreatmentStore}
 * backs unit tests.
 */
public interface TreatmentStore {

    /**
     * Stores a new episode. Assigns id and timestamps that are null on the input.
     * When the operator already has an OPEN episode on the symptom, returns that
     * one with {@code created=false}.
     */
    Inserted insert(Treatment treatment);

    record Inserted(Treatment treatment, boolean created) {
    }

    Optional<Treatment> find(String tenantCode, String id);

    /** The OPEN episode {@code actor} has on the symptom, if any. */
    Optional<Treatment> findOpen(String tenantCode, long symptomId, String actor);

    /** Oldest first. */
    List<Treatment> listBySymptom(String tenantCode, long symptomId);

    /** Moves an OPEN episode to {@code status}; empty when it was not open or not found. */
    default Optional<Treatment> transition(
            String tenantCode, String id, TreatmentStatus status, String actor, String resolution, String note) {
        return transition(tenantCode, id, status, actor, resolution, note, null);
    }

    /** Same, at the given time; null means now. */
    Optional<Treatment> transition(
            String tenantCode, String id, TreatmentStatus status, String actor, String resolution, String note,
            OffsetDateTime at);

    /**
     * Appends an action to an OPEN episode. Assigns id, the next {@code seq}, and
     * {@code performedAt} when null. Throws {@link IllegalStateException} when the
     * episode is missing or no longer open.
     */
    TreatmentAction addAction(TreatmentAction action);

    /** Actions of the given episodes, grouped by episode and ordered by {@code seq}. */
    List<TreatmentAction> listActions(String tenantCode, List<String> treatmentIds);

    /** Call statistics per tenant contact, derived from CALL actions. */
    List<ContactCallStats> contactStats(String tenantCode);
}
