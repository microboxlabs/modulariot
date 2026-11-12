package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.Contact;
import com.microboxlabs.miot.symptoms.domain.Treatment;
import com.microboxlabs.miot.symptoms.domain.TreatmentAction;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import com.microboxlabs.miot.symptoms.dto.AddActionRequest;
import com.microboxlabs.miot.symptoms.dto.CloseTreatmentRequest;
import com.microboxlabs.miot.symptoms.dto.OpenTreatmentRequest;
import com.microboxlabs.miot.symptoms.dto.TreatmentView;
import com.microboxlabs.miot.symptoms.store.ContactStore;
import com.microboxlabs.miot.symptoms.store.TreatmentStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Treatment lifecycle: open (or resume), add actions, close, cancel. Every
 * change is audited. Validation failures throw {@link IllegalArgumentException}
 * (400), a missing episode {@link NoSuchElementException} (404), a wrong state
 * {@link IllegalStateException} (409).
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class TreatmentService {

    static final String ENTITY = "treatment";
    /** On a {@code NOTE}: the operator skipped the level's call script to this step (1-based). */
    public static final String SKIP_TO_STEP = "skipToStep";
    private static final String SKIP_ID = "skipId";

    private final TreatmentStore treatments;
    private final ContactStore contacts;
    private final DemoSeeder seeder;
    private final AuditService audit;
    private final IgnoreHolds holds;

    public TreatmentService(TreatmentStore treatments, ContactStore contacts, DemoSeeder seeder, AuditService audit) {
        this(treatments, contacts, seeder, audit, IgnoreHolds.NONE);
    }

    @Inject
    public TreatmentService(TreatmentStore treatments, ContactStore contacts, DemoSeeder seeder, AuditService audit,
            IgnoreHolds holds) {
        this.treatments = treatments;
        this.contacts = contacts;
        this.seeder = seeder;
        this.audit = audit;
        this.holds = holds;
    }

    /**
     * Opens an episode, or returns the one {@code actor} already has open on
     * this symptom ({@code created=false}). Reopening the treatment panel,
     * retrying a request, or switching forms therefore lands on the same episode.
     */
    public OpenResult open(String tenantCode, String actor, long symptomId, OpenTreatmentRequest req) {
        if (req == null || req.type() == null) {
            throw new IllegalArgumentException("type is required (CALL, IGNORE_CONDITION, INVALIDATE_SYMPTOM)");
        }
        seeder.ensureHistory(tenantCode, symptomId);
        // Engine cases must reach insert(), which validates their case under the database row lock even on resume.
        Optional<Treatment> existing = symptomId < 0 ? Optional.empty() : treatments.findOpen(tenantCode, symptomId, actor);
        if (existing.isPresent()) {
            return new OpenResult(view(tenantCode, existing.get()), false);
        }
        TreatmentStore.Inserted inserted = treatments.insert(new Treatment(
                null, tenantCode, symptomId, blankToNull(req.assetId()), blankToNull(req.tripId()), req.type(),
                TreatmentStatus.OPEN, actor, null, null, null, null, blankToNull(req.note()), null));
        if (!inserted.created()) {
            // A concurrent request opened it first.
            return new OpenResult(view(tenantCode, inserted.treatment()), false);
        }
        Treatment saved = inserted.treatment();
        audit.log(tenantCode, actor, "treatment.opened", ENTITY, saved.id(), symptomId,
                Map.of("type", saved.type().name()));
        return new OpenResult(TreatmentView.of(saved, List.of()), true);
    }

    /** True when {@code actor} has an episode open on the symptom, which {@link #open} would resume. */
    public boolean hasOpen(String tenantCode, String actor, long symptomId) {
        return treatments.findOpen(tenantCode, symptomId, actor).isPresent();
    }

    public TreatmentAction addAction(String tenantCode, String actor, String treatmentId, AddActionRequest req) {
        if (req == null || req.kind() == null) {
            throw new IllegalArgumentException("kind is required (CALL, IGNORE, INVALIDATE, NOTE)");
        }
        Treatment t = requireOpen(tenantCode, treatmentId);
        return holds.locked(tenantCode, t, () -> addCheckedAction(tenantCode, actor, t, req));
    }

    private TreatmentAction addCheckedAction(String tenantCode, String actor, Treatment t, AddActionRequest req) {
        if (req.durationSeconds() != null && req.durationSeconds() < 0) {
            throw new IllegalArgumentException("durationSeconds must be >= 0");
        }
        CallTarget target = callTarget(tenantCode, req);
        if (req.kind() == ActionKind.CALL && target.name() == null) {
            throw new IllegalArgumentException("a CALL needs contactId or contactName");
        }
        if ((req.kind() == ActionKind.IGNORE || req.kind() == ActionKind.INVALIDATE)
                && blankToNull(req.outcomeKey()) == null && blankToNull(req.outcomeLabel()) == null) {
            throw new IllegalArgumentException(req.kind() + " needs an outcomeKey or outcomeLabel (the reason)");
        }
        if (recordsHandling(req) && blankToNull(req.note()) == null) {
            throw new IllegalArgumentException("a NOTE with an outcome (a handling record) needs a note");
        }
        if (isStepSkip(req)) {
            requireSkip(t, req);
            Optional<TreatmentAction> retried = retriedSkip(tenantCode, actor, t, req);
            if (retried.isPresent()) {
                return retried.get();
            }
        }
        IgnoreHolds.Checked checked = req.kind() == ActionKind.IGNORE
                ? holds.check(tenantCode, t, req)
                : unchecked(req);
        TreatmentAction saved = treatments.addAction(new TreatmentAction(
                null, t.id(), tenantCode, 0, req.kind(), target.id(), target.name(), target.role(), target.phone(),
                req.method(), blankToNull(req.outcomeKey()), blankToNull(req.outcomeLabel()), req.answered(),
                checked.durationSeconds(), blankToNull(req.message()), blankToNull(req.note()), tags(req.tags()),
                checked.details(), actor, null));
        audit.log(tenantCode, actor, "treatment.action_added", ENTITY, t.id(), t.symptomId(), auditDetails(saved));
        if (saved.kind() == ActionKind.IGNORE) {
            holds.started(tenantCode, t);
        }
        return saved;
    }

    private static boolean recordsHandling(AddActionRequest req) {
        return req.kind() == ActionKind.NOTE
                && (blankToNull(req.outcomeKey()) != null || blankToNull(req.outcomeLabel()) != null);
    }

    private static boolean isStepSkip(AddActionRequest req) {
        return req.kind() == ActionKind.NOTE && req.details() != null && req.details().containsKey(SKIP_TO_STEP);
    }

    /** The case lock serializes retries, including requests served by different replicas. */
    private Optional<TreatmentAction> retriedSkip(String tenantCode, String actor, Treatment t, AddActionRequest req) {
        Object skipId = req.details().get(SKIP_ID);
        if (skipId == null) {
            return Optional.empty();
        }
        if (!(skipId instanceof String key)) {
            throw new IllegalArgumentException("skipId must be a UUID");
        }
        UUID.fromString(key);
        return treatments.listActions(tenantCode, List.of(t.id())).stream()
                .filter(a -> a.kind() == ActionKind.NOTE && actor.equals(a.performedBy())
                        && a.details() != null && key.equals(a.details().get(SKIP_ID)))
                .findFirst();
    }

    /** A step skip names a later step of an engine case's call script and says why. */
    private static void requireSkip(Treatment t, AddActionRequest req) {
        if (t.symptomId() >= 0) {
            throw new IllegalArgumentException(SKIP_TO_STEP + " applies to an engine case (negative symptom id)");
        }
        Object step = req.details().get(SKIP_TO_STEP);
        if (!(step instanceof Integer || step instanceof Long) || ((Number) step).longValue() < 2) {
            throw new IllegalArgumentException(SKIP_TO_STEP + " must be a step number >= 2");
        }
        if (blankToNull(req.note()) == null) {
            throw new IllegalArgumentException("a step skip needs a note (the reason)");
        }
    }

    private static IgnoreHolds.Checked unchecked(AddActionRequest req) {
        Map<String, Object> details = req.details() == null ? Map.of() : req.details();
        return new IgnoreHolds.Checked(req.durationSeconds(), details);
    }

    /** Who an action is about: the request's fields, completed from the saved contact when one is named. */
    private record CallTarget(String id, String name, String role, String phone) {
    }

    private CallTarget callTarget(String tenantCode, AddActionRequest req) {
        String contactId = blankToNull(req.contactId());
        CallTarget given = new CallTarget(contactId, blankToNull(req.contactName()), blankToNull(req.contactRole()),
                blankToNull(req.contactPhone()));
        if (contactId == null) {
            return given;
        }
        Contact c = contacts.find(tenantCode, contactId)
                .orElseThrow(() -> new IllegalArgumentException("contactId not found: " + contactId));
        if (req.kind() == ActionKind.CALL) {
            requireChannel(c, req.method());
        }
        return new CallTarget(contactId, orElse(given.name(), c.name()), orElse(given.role(), c.role()),
                orElse(given.phone(), c.phone()));
    }

    /** A call to a saved contact goes through a channel the contact has. Ad hoc contacts are not checked. */
    private static void requireChannel(Contact c, CallMethod method) {
        if (method == null) {
            throw new IllegalArgumentException("a CALL to a saved contact needs a method");
        }
        List<CallMethod> methods = c.methods() == null ? List.of() : c.methods();
        if (!methods.contains(method)) {
            String has = methods.isEmpty() ? "none" : String.join(", ", methods.stream().map(Enum::name).toList());
            throw new IllegalArgumentException("contact " + c.id() + " has no " + method + " channel; its channels: "
                    + has);
        }
    }

    private static String orElse(String value, String fallback) {
        return value == null ? fallback : value;
    }

    private static List<String> tags(List<String> tags) {
        return tags == null ? List.of() : tags.stream().filter(x -> x != null && !x.isBlank()).toList();
    }

    private static Map<String, Object> auditDetails(TreatmentAction saved) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("kind", saved.kind().name());
        details.put("seq", saved.seq());
        if (saved.contactName() != null) {
            details.put("contactName", saved.contactName());
        }
        if (saved.outcomeLabel() != null) {
            details.put("outcome", saved.outcomeLabel());
        }
        if (saved.kind() == ActionKind.NOTE && saved.details() != null
                && saved.details().get(SKIP_TO_STEP) != null) {
            auditSkipDetails(saved, details);
        }
        if (saved.recordsHandling()) {
            details.put("note", saved.note());
            if (saved.outcomeKey() != null) {
                details.put("outcomeKey", saved.outcomeKey());
            }
        }
        if (saved.kind() == ActionKind.IGNORE) {
            if (saved.note() != null) {
                details.put("note", saved.note());
            }
            if (saved.durationSeconds() != null) {
                details.put("durationSeconds", saved.durationSeconds());
            }
            if (saved.details() != null) {
                saved.details().forEach(details::putIfAbsent);
            }
        }
        return details;
    }

    private static void auditSkipDetails(TreatmentAction saved, Map<String, Object> details) {
        for (String key : List.of(SKIP_TO_STEP, "level", "version", SKIP_ID, "slaSince")) {
            if (saved.details().get(key) != null) {
                details.put(key, saved.details().get(key));
            }
        }
        if (saved.note() != null) {
            details.put("note", saved.note());
        }
    }

    public TreatmentView close(String tenantCode, String actor, String treatmentId, CloseTreatmentRequest req) {
        Treatment t = requireOpen(tenantCode, treatmentId);
        return holds.locked(tenantCode, t, () -> closeChecked(tenantCode, actor, t, req));
    }

    private TreatmentView closeChecked(String tenantCode, String actor, Treatment t, CloseTreatmentRequest req) {
        List<TreatmentAction> actions = treatments.listActions(tenantCode, List.of(t.id()));
        if (t.symptomId() < 0 && actions.stream().anyMatch(a -> a.kind() == ActionKind.IGNORE)) {
            throw new IllegalStateException("the case is on hold: resume it instead");
        }
        if (actions.isEmpty()) {
            throw new IllegalStateException("a treatment needs at least one action before it can be closed");
        }
        CloseTreatmentRequest body = req == null ? new CloseTreatmentRequest(null, null) : req;
        Treatment closed = treatments.transition(tenantCode, t.id(), TreatmentStatus.CLOSED, actor,
                        blankToNull(body.resolution()), blankToNull(body.note()))
                .orElseThrow(() -> new IllegalStateException("treatment is no longer open"));
        audit.log(tenantCode, actor, "treatment.closed", ENTITY, closed.id(), closed.symptomId(), Map.of(
                "resolution", closed.resolution() == null ? "" : closed.resolution(),
                "actions", actions.size()));
        if (actions.stream().anyMatch(a -> a.kind() == ActionKind.IGNORE)) {
            holds.changed(tenantCode);
        }
        return TreatmentView.of(closed, actions);
    }

    /** A disconnected panel must never cancel a recorded action or another operator's episode. */
    public void abandon(String tenantCode, String actor, String treatmentId) {
        treatments.cancelEmpty(tenantCode, treatmentId, actor).ifPresent(cancelled ->
                audit.log(tenantCode, actor, "treatment.cancelled", ENTITY, cancelled.id(), cancelled.symptomId(),
                        Map.of("reason", "panel closed")));
    }

    /**
     * Abandons an open episode, e.g. a form that was opened and dismissed. An engine case's hold is resumed, not
     * cancelled.
     */
    public TreatmentView cancel(String tenantCode, String actor, String treatmentId, String reason) {
        Treatment t = requireOpen(tenantCode, treatmentId);
        return holds.locked(tenantCode, t, () -> cancelChecked(tenantCode, actor, t, reason));
    }

    private TreatmentView cancelChecked(String tenantCode, String actor, Treatment t, String reason) {
        if (t.symptomId() < 0 && treatments.listActions(tenantCode, List.of(t.id())).stream()
                .anyMatch(a -> a.kind() == ActionKind.IGNORE)) {
            throw new IllegalStateException("the case is on hold: resume it instead");
        }
        Treatment cancelled = treatments.transition(
                        tenantCode, t.id(), TreatmentStatus.CANCELLED, actor, "cancelled", blankToNull(reason))
                .orElseThrow(() -> new IllegalStateException("treatment is no longer open"));
        audit.log(tenantCode, actor, "treatment.cancelled", ENTITY, cancelled.id(), cancelled.symptomId(),
                Map.of("reason", reason == null ? "" : reason));
        return view(tenantCode, cancelled);
    }

    /** Actions read before a resume commits, avoiding a failing read after a successful mutation. */
    public List<TreatmentAction> actionsOf(String tenantCode, String treatmentId) {
        return treatments.listActions(tenantCode, List.of(treatmentId));
    }

    public TreatmentView get(String tenantCode, String treatmentId) {
        return view(tenantCode, treatments.find(tenantCode, treatmentId)
                .orElseThrow(() -> new NoSuchElementException("treatment not found")));
    }

    /** Oldest first, each with its actions. */
    public List<TreatmentView> listForSymptom(String tenantCode, long symptomId) {
        seeder.ensureHistory(tenantCode, symptomId);
        List<Treatment> episodes = treatments.listBySymptom(tenantCode, symptomId);
        Map<String, List<TreatmentAction>> actionsById = treatments
                .listActions(tenantCode, episodes.stream().map(Treatment::id).toList())
                .stream()
                .collect(Collectors.groupingBy(TreatmentAction::treatmentId));
        return episodes.stream()
                .map(t -> TreatmentView.of(t, actionsById.getOrDefault(t.id(), List.of())))
                .toList();
    }

    /** {@link #listForSymptom} for several symptoms, by symptom id; a symptom without treatments is absent. */
    public Map<Long, List<TreatmentView>> listForSymptoms(String tenantCode, Collection<Long> symptomIds) {
        symptomIds.forEach(id -> seeder.ensureHistory(tenantCode, id));
        List<Treatment> episodes = treatments.listBySymptoms(tenantCode, symptomIds);
        Map<String, List<TreatmentAction>> actionsById = episodes.isEmpty() ? Map.of() : treatments
                .listActions(tenantCode, episodes.stream().map(Treatment::id).toList())
                .stream()
                .collect(Collectors.groupingBy(TreatmentAction::treatmentId));
        return episodes.stream().collect(Collectors.groupingBy(Treatment::symptomId, LinkedHashMap::new,
                Collectors.mapping(t -> TreatmentView.of(t, actionsById.getOrDefault(t.id(), List.of())),
                        Collectors.toList())));
    }

    public record OpenResult(TreatmentView treatment, boolean created) {
    }

    private Treatment requireOpen(String tenantCode, String treatmentId) {
        Treatment t = treatments.find(tenantCode, treatmentId)
                .orElseThrow(() -> new NoSuchElementException("treatment not found"));
        if (t.status() != TreatmentStatus.OPEN) {
            throw new IllegalStateException("treatment is " + t.status());
        }
        return t;
    }

    private TreatmentView view(String tenantCode, Treatment t) {
        return TreatmentView.of(t, treatments.listActions(tenantCode, List.of(t.id())));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
