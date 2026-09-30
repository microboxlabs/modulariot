package com.microboxlabs.miot.symptoms.store;

import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.ContactCallStats;
import com.microboxlabs.miot.symptoms.domain.Treatment;
import com.microboxlabs.miot.symptoms.domain.TreatmentAction;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/** Process-local treatment store for unit tests. Not a CDI bean: the running service uses {@link PgTreatmentStore}. */
public class InMemoryTreatmentStore implements TreatmentStore {

    private final Map<String, Treatment> treatments = new LinkedHashMap<>();
    private final Map<String, List<TreatmentAction>> actions = new LinkedHashMap<>();

    @Override
    public synchronized Inserted insert(Treatment t) {
        if (t.status() == null || t.status() == TreatmentStatus.OPEN) {
            Optional<Treatment> open = findOpen(t.tenantCode(), t.symptomId(), t.openedBy());
            if (open.isPresent()) {
                return new Inserted(open.get(), false);
            }
        }
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        OffsetDateTime openedAt = t.openedAt() == null ? now : t.openedAt();
        Treatment saved = new Treatment(
                UUID.randomUUID().toString(), t.tenantCode(), t.symptomId(), t.assetId(), t.tripId(), t.type(),
                t.status() == null ? TreatmentStatus.OPEN : t.status(), t.openedBy(), openedAt, t.closedBy(),
                t.closedAt(), t.resolution(), t.note(), t.updatedAt() == null ? openedAt : t.updatedAt());
        treatments.put(saved.id(), saved);
        actions.put(saved.id(), new ArrayList<>());
        return new Inserted(saved, true);
    }

    @Override
    public synchronized Optional<Treatment> find(String tenantCode, String id) {
        Treatment t = id == null ? null : treatments.get(id);
        return t != null && t.tenantCode().equals(tenantCode) ? Optional.of(t) : Optional.empty();
    }

    @Override
    public synchronized Optional<Treatment> findOpen(String tenantCode, long symptomId, String actor) {
        return treatments.values().stream()
                .filter(t -> t.tenantCode().equals(tenantCode) && t.symptomId() == symptomId)
                .filter(t -> t.status() == TreatmentStatus.OPEN && Objects.equals(t.openedBy(), actor))
                .max(Comparator.comparing(Treatment::openedAt));
    }

    @Override
    public synchronized List<Treatment> listBySymptom(String tenantCode, long symptomId) {
        return treatments.values().stream()
                .filter(t -> t.tenantCode().equals(tenantCode) && t.symptomId() == symptomId)
                .sorted(Comparator.comparing(Treatment::openedAt))
                .toList();
    }

    @Override
    public synchronized Optional<Treatment> transition(
            String tenantCode, String id, TreatmentStatus status, String actor, String resolution, String note,
            OffsetDateTime at) {
        Optional<Treatment> current = find(tenantCode, id).filter(t -> t.status() == TreatmentStatus.OPEN);
        if (current.isEmpty()) {
            return Optional.empty();
        }
        Treatment t = current.get();
        OffsetDateTime now = at == null ? OffsetDateTime.now(ZoneOffset.UTC) : at;
        Treatment moved = new Treatment(t.id(), t.tenantCode(), t.symptomId(), t.assetId(), t.tripId(), t.type(),
                status, t.openedBy(), t.openedAt(), actor, now, resolution, note == null ? t.note() : note, now);
        treatments.put(moved.id(), moved);
        return Optional.of(moved);
    }

    @Override
    public synchronized TreatmentAction addAction(TreatmentAction a) {
        List<TreatmentAction> list = actions.get(a.treatmentId());
        Treatment current = treatments.get(a.treatmentId());
        if (list == null || current.status() != TreatmentStatus.OPEN) {
            throw new IllegalStateException("treatment not found or not open: " + a.treatmentId());
        }
        TreatmentAction saved = new TreatmentAction(
                UUID.randomUUID().toString(), a.treatmentId(), a.tenantCode(), list.size() + 1, a.kind(),
                a.contactId(), a.contactName(), a.contactRole(), a.contactPhone(), a.method(), a.outcomeKey(),
                a.outcomeLabel(), a.answered(), a.durationSeconds(), a.message(), a.note(),
                a.tags() == null ? List.of() : List.copyOf(a.tags()),
                a.details() == null ? Map.of() : Map.copyOf(a.details()),
                a.performedBy(), a.performedAt() == null ? OffsetDateTime.now(ZoneOffset.UTC) : a.performedAt());
        list.add(saved);
        Treatment t = treatments.get(a.treatmentId());
        treatments.put(t.id(), new Treatment(t.id(), t.tenantCode(), t.symptomId(), t.assetId(), t.tripId(),
                t.type(), t.status(), t.openedBy(), t.openedAt(), t.closedBy(), t.closedAt(), t.resolution(),
                t.note(), saved.performedAt()));
        return saved;
    }

    @Override
    public synchronized List<TreatmentAction> listActions(String tenantCode, List<String> treatmentIds) {
        List<TreatmentAction> out = new ArrayList<>();
        for (String id : treatmentIds) {
            if (find(tenantCode, id).isPresent()) {
                out.addAll(actions.getOrDefault(id, List.of()));
            }
        }
        return out;
    }

    @Override
    public synchronized List<ContactCallStats> contactStats(String tenantCode) {
        Map<String, long[]> counts = new LinkedHashMap<>();
        Map<String, OffsetDateTime> last = new LinkedHashMap<>();
        for (TreatmentAction a : contactCalls(tenantCode)) {
            long[] c = counts.computeIfAbsent(a.contactId(), k -> new long[2]);
            if (Boolean.TRUE.equals(a.answered())) {
                c[0]++;
            } else if (Boolean.FALSE.equals(a.answered())) {
                c[1]++;
            }
            last.merge(a.contactId(), a.performedAt(), (x, y) -> x.isAfter(y) ? x : y);
        }
        List<ContactCallStats> out = new ArrayList<>();
        counts.forEach((id, c) -> out.add(new ContactCallStats(id, last.get(id), c[0], c[1])));
        return out;
    }

    /** The tenant's CALL actions made to a saved contact. */
    private List<TreatmentAction> contactCalls(String tenantCode) {
        return treatments.values().stream()
                .filter(t -> t.tenantCode().equals(tenantCode))
                .flatMap(t -> actions.getOrDefault(t.id(), List.of()).stream())
                .filter(a -> a.kind() == ActionKind.CALL && a.contactId() != null)
                .toList();
    }
}
