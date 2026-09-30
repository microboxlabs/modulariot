package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.symptoms.domain.ActionKind;
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
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Treatment lifecycle: open (or resume), add actions, close, cancel. Every
 * change is audited. Validation failures throw {@link IllegalArgumentException}
 * (400), a missing episode {@link NoSuchElementException} (404), a wrong state
 * {@link IllegalStateException} (409).
 */
@ApplicationScoped
public class TreatmentService {

    static final String ENTITY = "treatment";

    private final TreatmentStore treatments;
    private final ContactStore contacts;
    private final DemoSeeder seeder;
    private final AuditService audit;

    @Inject
    public TreatmentService(TreatmentStore treatments, ContactStore contacts, DemoSeeder seeder, AuditService audit) {
        this.treatments = treatments;
        this.contacts = contacts;
        this.seeder = seeder;
        this.audit = audit;
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
        Optional<Treatment> existing = treatments.findOpen(tenantCode, symptomId, actor);
        if (existing.isPresent()) {
            return new OpenResult(view(tenantCode, existing.get()), false);
        }
        Treatment saved = treatments.insert(new Treatment(
                null, tenantCode, symptomId, blankToNull(req.assetId()), blankToNull(req.tripId()), req.type(),
                TreatmentStatus.OPEN, actor, null, null, null, null, blankToNull(req.note()), null));
        audit.log(tenantCode, actor, "treatment.opened", ENTITY, saved.id(), symptomId,
                Map.of("type", saved.type().name()));
        return new OpenResult(TreatmentView.of(saved, List.of()), true);
    }

    public TreatmentAction addAction(String tenantCode, String actor, String treatmentId, AddActionRequest req) {
        if (req == null || req.kind() == null) {
            throw new IllegalArgumentException("kind is required (CALL, IGNORE, INVALIDATE, NOTE)");
        }
        Treatment t = requireOpen(tenantCode, treatmentId);
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
        TreatmentAction saved = treatments.addAction(new TreatmentAction(
                null, t.id(), tenantCode, 0, req.kind(), target.id(), target.name(), target.role(), target.phone(),
                req.method(), blankToNull(req.outcomeKey()), blankToNull(req.outcomeLabel()), req.answered(),
                req.durationSeconds(), blankToNull(req.message()), blankToNull(req.note()), tags(req.tags()),
                req.details() == null ? Map.of() : req.details(), actor, null));
        audit.log(tenantCode, actor, "treatment.action_added", ENTITY, t.id(), t.symptomId(), auditDetails(saved));
        return saved;
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
        return new CallTarget(contactId, orElse(given.name(), c.name()), orElse(given.role(), c.role()),
                orElse(given.phone(), c.phone()));
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
        return details;
    }

    public TreatmentView close(String tenantCode, String actor, String treatmentId, CloseTreatmentRequest req) {
        Treatment t = requireOpen(tenantCode, treatmentId);
        List<TreatmentAction> actions = treatments.listActions(tenantCode, List.of(t.id()));
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
        return TreatmentView.of(closed, actions);
    }

    /** Abandons an open episode, e.g. a form that was opened and dismissed. */
    public TreatmentView cancel(String tenantCode, String actor, String treatmentId, String reason) {
        Treatment t = requireOpen(tenantCode, treatmentId);
        Treatment cancelled = treatments.transition(
                        tenantCode, t.id(), TreatmentStatus.CANCELLED, actor, "cancelled", blankToNull(reason))
                .orElseThrow(() -> new IllegalStateException("treatment is no longer open"));
        audit.log(tenantCode, actor, "treatment.cancelled", ENTITY, cancelled.id(), cancelled.symptomId(),
                Map.of("reason", reason == null ? "" : reason));
        return view(tenantCode, cancelled);
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
