package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.Contact;
import com.microboxlabs.miot.symptoms.domain.Treatment;
import com.microboxlabs.miot.symptoms.domain.TreatmentAction;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import com.microboxlabs.miot.symptoms.dto.AddActionRequest;
import com.microboxlabs.miot.symptoms.dto.CloseTreatmentRequest;
import com.microboxlabs.miot.symptoms.dto.OpenTreatmentRequest;
import com.microboxlabs.miot.symptoms.dto.SymptomTreatmentsView;
import com.microboxlabs.miot.symptoms.dto.TreatmentView;
import com.microboxlabs.miot.symptoms.persistence.ContactRepository;
import com.microboxlabs.miot.symptoms.persistence.TreatmentRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Treatment lifecycle: open, add actions, close or cancel. Every state change
 * is audited, and open/close are mirrored into StreamHub so the engine keeps
 * treating the symptom as attended. Validation failures throw
 * {@link IllegalArgumentException} (400), a missing episode
 * {@link NoSuchElementException} (404), a wrong state
 * {@link IllegalStateException} (409).
 */
@ApplicationScoped
public class TreatmentService {

    static final String ENTITY = "treatment";

    private final TreatmentRepository treatments;
    private final ContactRepository contacts;
    private final LegacyTreatmentMirror mirror;
    private final SymptomsTenantResolver tenants;
    private final SymptomQueryService symptoms;
    private final AuditService audit;

    @Inject
    public TreatmentService(
            TreatmentRepository treatments,
            ContactRepository contacts,
            LegacyTreatmentMirror mirror,
            SymptomsTenantResolver tenants,
            SymptomQueryService symptoms,
            AuditService audit) {
        this.treatments = treatments;
        this.contacts = contacts;
        this.mirror = mirror;
        this.tenants = tenants;
        this.symptoms = symptoms;
        this.audit = audit;
    }

    /** Opens an episode. A repeated {@code idempotencyKey} returns the existing one and {@code created=false}. */
    public OpenResult open(String tenantCode, String actor, long symptomId, OpenTreatmentRequest req) {
        if (req == null || req.type() == null) {
            throw new IllegalArgumentException("type is required (CALL, IGNORE_CONDITION, INVALIDATE_SYMPTOM)");
        }
        String key = blankToNull(req.idempotencyKey());
        if (key != null) {
            Optional<Treatment> existing = treatments.findByIdempotencyKey(tenantCode, key);
            if (existing.isPresent()) {
                if (existing.get().symptomId() != symptomId) {
                    throw new IllegalArgumentException("idempotencyKey already used for another symptom");
                }
                return new OpenResult(view(tenantCode, existing.get()), false);
            }
        }
        long legacyId = mirror.upsert(new LegacyTreatmentMirror.Write(
                null, tenants.symptomsClientId(tenantCode), symptomId, blankToNull(req.assetId()),
                blankToNull(req.tripId()), req.type(), actor, null, null));
        Treatment saved = treatments.insert(new Treatment(
                null, tenantCode, symptomId, blankToNull(req.assetId()), blankToNull(req.tripId()),
                req.type(), TreatmentStatus.OPEN, actor, null, null, null, null, blankToNull(req.note()),
                legacyId, key, null));
        audit.record(tenantCode, actor, "treatment.opened", ENTITY, saved.id(), symptomId, Map.of(
                "type", saved.type().name(),
                "legacyTreatmentId", legacyId,
                "assetId", nullToEmpty(saved.assetId()),
                "tripId", nullToEmpty(saved.tripId())));
        return new OpenResult(TreatmentView.of(saved, List.of()), true);
    }

    public TreatmentAction addAction(String tenantCode, String actor, String treatmentId, AddActionRequest req) {
        if (req == null || req.kind() == null) {
            throw new IllegalArgumentException("kind is required (CALL, IGNORE, INVALIDATE, NOTE)");
        }
        Treatment t = requireOpen(tenantCode, treatmentId);
        if (!t.type().accepts(req.kind())) {
            throw new IllegalArgumentException(
                    "action kind " + req.kind() + " is not allowed on a " + t.type() + " treatment");
        }
        if (req.durationSeconds() != null && req.durationSeconds() < 0) {
            throw new IllegalArgumentException("durationSeconds must be >= 0");
        }
        String contactId = blankToNull(req.contactId());
        String contactName = blankToNull(req.contactName());
        String contactRole = blankToNull(req.contactRole());
        String contactPhone = blankToNull(req.contactPhone());
        if (contactId != null) {
            Contact c = contacts.findById(tenantCode, contactId)
                    .orElseThrow(() -> new IllegalArgumentException("contactId not found: " + contactId));
            contactName = contactName == null ? c.name() : contactName;
            contactRole = contactRole == null ? c.role() : contactRole;
            contactPhone = contactPhone == null ? c.phone() : contactPhone;
        }
        if (req.kind() == ActionKind.CALL && contactName == null) {
            throw new IllegalArgumentException("a CALL needs contactId or contactName");
        }
        if (req.kind() != ActionKind.CALL && req.kind() != ActionKind.NOTE && blankToNull(req.outcomeKey()) == null
                && blankToNull(req.outcomeLabel()) == null) {
            throw new IllegalArgumentException(req.kind() + " needs an outcomeKey or outcomeLabel (the reason)");
        }
        TreatmentAction saved = treatments.insertAction(new TreatmentAction(
                null, t.id(), tenantCode, 0, req.kind(), contactId, contactName, contactRole, contactPhone,
                req.method(), blankToNull(req.outcomeKey()), blankToNull(req.outcomeLabel()), req.answered(),
                req.durationSeconds(), blankToNull(req.note()),
                req.tags() == null ? List.of() : req.tags().stream().filter(x -> x != null && !x.isBlank()).toList(),
                req.details() == null ? Map.of() : req.details(), actor, null));
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("kind", saved.kind().name());
        details.put("seq", saved.seq());
        if (saved.contactName() != null) {
            details.put("contactName", saved.contactName());
        }
        if (saved.outcomeLabel() != null) {
            details.put("outcome", saved.outcomeLabel());
        }
        audit.record(tenantCode, actor, "treatment.action_added", ENTITY, t.id(), t.symptomId(), details);
        return saved;
    }

    public TreatmentView close(String tenantCode, String actor, String treatmentId, CloseTreatmentRequest req) {
        Treatment t = requireOpen(tenantCode, treatmentId);
        List<TreatmentAction> actions = treatments.listActions(tenantCode, List.of(t.id()));
        CloseTreatmentRequest body = req == null ? new CloseTreatmentRequest(null, null, null, null) : req;
        String message = blankToNull(body.messageToDriver());
        String response = blankToNull(body.driverResponse());
        if (message == null) {
            message = summarize(actions, false);
        }
        if (response == null) {
            response = summarize(actions, true);
        }
        if (t.legacyTreatmentId() != null) {
            mirror.upsert(new LegacyTreatmentMirror.Write(
                    t.legacyTreatmentId(), tenants.symptomsClientId(tenantCode), t.symptomId(), t.assetId(),
                    t.tripId(), t.type(), actor, message, response));
        }
        Treatment closed = treatments.transition(
                        tenantCode, t.id(), TreatmentStatus.CLOSED, actor, blankToNull(body.resolution()),
                        blankToNull(body.note()))
                .orElseThrow(() -> new IllegalStateException("treatment is no longer open"));
        audit.record(tenantCode, actor, "treatment.closed", ENTITY, closed.id(), closed.symptomId(), Map.of(
                "resolution", nullToEmpty(closed.resolution()),
                "actions", actions.size()));
        return TreatmentView.of(closed, actions);
    }

    /** Abandons an open episode. The legacy row is left as it is; the engine expires it like any other. */
    public TreatmentView cancel(String tenantCode, String actor, String treatmentId, String reason) {
        Treatment t = requireOpen(tenantCode, treatmentId);
        Treatment cancelled = treatments.transition(
                        tenantCode, t.id(), TreatmentStatus.CANCELLED, actor, "cancelled", blankToNull(reason))
                .orElseThrow(() -> new IllegalStateException("treatment is no longer open"));
        audit.record(tenantCode, actor, "treatment.cancelled", ENTITY, cancelled.id(), cancelled.symptomId(),
                Map.of("reason", nullToEmpty(reason)));
        return view(tenantCode, cancelled);
    }

    public TreatmentView get(String tenantCode, String treatmentId) {
        Treatment t = treatments.findById(tenantCode, treatmentId)
                .orElseThrow(() -> new NoSuchElementException("treatment not found"));
        return view(tenantCode, t);
    }

    public SymptomTreatmentsView listForSymptom(String tenantCode, long symptomId, boolean includeLegacy) {
        List<Treatment> episodes = treatments.listBySymptom(tenantCode, symptomId);
        Map<String, List<TreatmentAction>> actionsById = treatments
                .listActions(tenantCode, episodes.stream().map(Treatment::id).toList())
                .stream()
                .collect(Collectors.groupingBy(TreatmentAction::treatmentId));
        List<TreatmentView> views = new ArrayList<>();
        for (Treatment t : episodes) {
            views.add(TreatmentView.of(t, actionsById.getOrDefault(t.id(), List.of())));
        }
        return new SymptomTreatmentsView(
                symptomId, views, includeLegacy ? symptoms.legacyTreatments(tenantCode, symptomId) : List.of());
    }

    public record OpenResult(TreatmentView treatment, boolean created) {
    }

    private Treatment requireOpen(String tenantCode, String treatmentId) {
        Treatment t = treatments.findById(tenantCode, treatmentId)
                .orElseThrow(() -> new NoSuchElementException("treatment not found"));
        if (t.status() != TreatmentStatus.OPEN) {
            throw new IllegalStateException("treatment is " + t.status());
        }
        return t;
    }

    private TreatmentView view(String tenantCode, Treatment t) {
        return TreatmentView.of(t, treatments.listActions(tenantCode, List.of(t.id())));
    }

    /**
     * Legacy rows keep two free-text fields. {@code message} becomes "who was
     * contacted and how"; {@code driverResponse} becomes the outcomes and notes.
     */
    static String summarize(List<TreatmentAction> actions, boolean outcomes) {
        List<String> parts = new ArrayList<>();
        for (TreatmentAction a : actions) {
            if (outcomes) {
                StringBuilder sb = new StringBuilder();
                if (a.outcomeLabel() != null) {
                    sb.append(a.outcomeLabel());
                }
                if (a.note() != null) {
                    sb.append(sb.isEmpty() ? "" : " · ").append(a.note());
                }
                if (!sb.isEmpty()) {
                    parts.add(sb.toString());
                }
            } else if (a.kind() == ActionKind.CALL) {
                StringBuilder sb = new StringBuilder("Llamado a: ").append(a.contactName());
                if (a.contactRole() != null) {
                    sb.append(" (").append(a.contactRole()).append(')');
                }
                if (a.method() != null) {
                    sb.append(" · ").append(a.method().name().toLowerCase());
                }
                parts.add(sb.toString());
            } else if (a.kind() != ActionKind.NOTE && a.outcomeLabel() != null) {
                parts.add(a.kind().name().toLowerCase() + ": " + a.outcomeLabel());
            }
        }
        return parts.isEmpty() ? null : String.join(" | ", parts);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
