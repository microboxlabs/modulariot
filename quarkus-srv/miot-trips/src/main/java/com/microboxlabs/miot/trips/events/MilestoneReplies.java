package com.microboxlabs.miot.trips.events;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.event.OperationalEvent;
import com.microboxlabs.miot.trips.domain.TripMilestone;
import com.microboxlabs.miot.trips.service.MilestoneService;
import com.microboxlabs.miot.trips.service.MilestoneService.DetectionRef;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.ObservesAsync;
import jakarta.inject.Inject;
import java.text.Normalizer;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.jboss.logging.Logger;

/**
 * Confirms or rejects a pending milestone from a reply to its notice: {@code conversation.reply_received} about a
 * trip, answering a {@code trip.milestone.detected}. The button's payload, else the reply's text, decides:
 * {@code confirm} / "Confirmar" / "Sí" confirms at the detected time, {@code reject} / "No corresponde" / "No"
 * rejects. The person who replied is recorded with channel {@code reply}. A reply to a milestone no longer pending,
 * or one that says neither, changes nothing.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class MilestoneReplies {

    public static final String REPLY_RECEIVED = "conversation.reply_received";

    private static final Logger LOG = Logger.getLogger(MilestoneReplies.class);
    private static final Set<String> CONFIRM = Set.of("confirm", "confirmar", "confirmado", "si", "ok");
    private static final Set<String> REJECT = Set.of("reject", "rechazar", "no", "no corresponde");

    /** What a reply did. */
    public enum Outcome { CONFIRMED, REJECTED, NOT_PENDING, UNCLEAR, NOT_A_MILESTONE }

    private final MilestoneService milestones;
    private final ObjectMapper json;

    @Inject
    public MilestoneReplies(MilestoneService milestones, ObjectMapper json) {
        this.milestones = milestones;
        this.json = json;
    }

    void onEvent(@ObservesAsync OperationalEvent event) {
        if (!REPLY_RECEIVED.equals(event.type()) || !TripEventCatalog.CONTEXT_KIND.equals(event.context().kind())
                || event.test()) {
            return;
        }
        try {
            Outcome outcome = apply(event);
            LOG.infof("Reply about trip %s: %s", event.context().key(), outcome);
        } catch (RuntimeException e) {
            LOG.warnf("Reply about trip %s not applied: %s", event.context().key(), e.getMessage());
        }
    }

    /** Applies the reply to the milestone its notice asked about. */
    public Outcome apply(OperationalEvent event) {
        JsonNode data = json.valueToTree(event.data());
        if (!TripEventCatalog.MILESTONE_DETECTED.equals(data.path("eventType").asText(null))) {
            return Outcome.NOT_A_MILESTONE;
        }
        String milestone = data.path("eventData").path("milestone").asText(null);
        if (milestone == null || !TripMilestone.MILESTONES.contains(milestone)) {
            return Outcome.NOT_A_MILESTONE;
        }
        JsonNode detected = data.path("eventData");
        if (!event.context().key().equals(detected.path("tripId").asText(null))
                || !detected.path("proposedAt").isTextual()) {
            return Outcome.NOT_A_MILESTONE;
        }
        OffsetDateTime proposedAt;
        try {
            proposedAt = OffsetDateTime.parse(detected.path("proposedAt").asText());
        } catch (DateTimeParseException e) {
            return Outcome.NOT_A_MILESTONE;
        }
        String payload = data.path("buttonPayload").asText(null);
        Optional<Boolean> confirm = decision(payload != null ? payload : data.path("text").asText(null));
        if (confirm.isEmpty()) {
            return Outcome.UNCLEAR;
        }
        UUID tripId = UUID.fromString(event.context().key());
        String tenant = event.tenantCode();
        String actor = data.path("channel").asText("reply") + ":" + data.path("address").asText("unknown");
        DetectionRef detection = new DetectionRef(milestone, proposedAt, detected.path("source").asText(null));
        MilestoneService.Result result = milestones.respondToDetection(tenant, actor, tripId, detection, confirm.get())
                .result();
        return switch (result) {
            case CONFIRMED -> Outcome.CONFIRMED;
            case REJECTED -> Outcome.REJECTED;
            default -> Outcome.NOT_PENDING;
        };
    }

    /** True to confirm, false to reject, empty when the words say neither. */
    static Optional<Boolean> decision(String words) {
        if (words == null || words.isBlank()) {
            return Optional.empty();
        }
        String w = Normalizer.normalize(words.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
        if (CONFIRM.contains(w)) {
            return Optional.of(true);
        }
        return REJECT.contains(w) ? Optional.of(false) : Optional.empty();
    }
}
