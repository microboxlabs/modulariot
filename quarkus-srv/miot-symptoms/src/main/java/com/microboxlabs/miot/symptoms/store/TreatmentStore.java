package com.microboxlabs.miot.symptoms.store;

import com.microboxlabs.miot.symptoms.domain.ContactCallStats;
import com.microboxlabs.miot.symptoms.domain.Treatment;
import com.microboxlabs.miot.symptoms.domain.TreatmentAction;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

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

    /** Statistics for one page of contacts. Persistent stores should bound the query by these ids. */
    default List<ContactCallStats> contactStats(String tenantCode, List<String> contactIds) {
        return contactStats(tenantCode).stream().filter(s -> contactIds.contains(s.contactId())).toList();
    }

    /** When an operator first took each of these cases; cases nobody took are left out. */
    Map<Long, OffsetDateTime> firstOpenedAt(String tenantCode, Collection<Long> symptomIds);

    /**
     * The operator's CALL actions since {@code since} whose telephony record is still pending
     * ({@code details.telephony.status = PENDING}), oldest first, at most 50.
     */
    default List<TreatmentAction> pendingTelephonyCalls(String tenantCode, String performedBy,
            OffsetDateTime since) {
        throw new UnsupportedOperationException("pendingTelephonyCalls");
    }

    /** Who placed a call: the organization and the operator. */
    record Caller(String tenantCode, String performedBy) {
    }

    /**
     * Every organization and operator with a Teams CALL action since {@code since} whose telephony record is
     * still pending, at most {@code limit}.
     */
    default List<Caller> pendingTeamsCallers(OffsetDateTime since, int limit) {
        return pendingTeamsCallers(since, limit, null);
    }

    /** Starts after the previous batch's last caller, wrapping around in the same bounded query. */
    default List<Caller> pendingTeamsCallers(OffsetDateTime since, int limit, Caller after) {
        throw new UnsupportedOperationException("pendingTeamsCallers");
    }

    /**
     * Fills a pending CALL action with what the provider recorded. Null {@code answered} means unknown;
     * null {@code durationSeconds} keeps the timed duration. Details replace the stored details.
     * Returns empty when another request already settled the action or assigned that provider record.
     * Works on closed treatments too, since records arrive after the call.
     */
    default Optional<TreatmentAction> updateCallResult(String tenantCode, String actionId, Boolean answered,
            Integer durationSeconds, Map<String, Object> details) {
        throw new UnsupportedOperationException("updateCallResult");
    }

    /** Provider records already assigned on this tenant's connection, including closed treatments. */
    default Set<String> recordedTelephonyRecordIds(String tenantCode, String connectionId) {
        throw new UnsupportedOperationException("recordedTelephonyRecordIds");
    }
}
