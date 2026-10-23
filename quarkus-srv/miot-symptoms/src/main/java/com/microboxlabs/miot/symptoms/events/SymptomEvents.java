package com.microboxlabs.miot.symptoms.events;

import com.microboxlabs.miot.core.event.EventContext;
import com.microboxlabs.miot.core.event.OperationalEvent;
import com.microboxlabs.miot.symptoms.cases.EngineCase;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.evaluator.Transition;
import com.microboxlabs.miot.symptoms.evaluator.TransitionLog.Place;
import com.microboxlabs.miot.symptoms.evaluator.TransitionLog.Recorded;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.function.Function;
import org.jboss.logging.Logger;

/**
 * Publishes the {@code symptom.case.*} events as {@link OperationalEvent}s, asynchronously, so a slow or failing
 * observer never holds the evaluator. The context is {@code {kind: "symptom_case", key: <symptom id>}}, the id
 * the Control Tower gives the case. TEST symptoms publish with {@code test} set.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class SymptomEvents {

    private static final Logger LOG = Logger.getLogger(SymptomEvents.class);

    /** Publishes nothing. */
    public static final SymptomEvents NONE = new SymptomEvents(e -> CompletableFuture.completedFuture(e));

    private final Function<OperationalEvent, CompletionStage<?>> fire;

    @Inject
    SymptomEvents(Event<OperationalEvent> bus) {
        this(bus::fireAsync);
    }

    public SymptomEvents(Function<OperationalEvent, CompletionStage<?>> fire) {
        this.fire = fire;
    }

    /** One event per change the evaluator recorded. */
    public void transitions(String tenantCode, List<Recorded> recorded, Place place) {
        for (Recorded r : recorded) {
            Transition t = r.transition();
            SymptomCaseData data = new SymptomCaseData(-r.caseId(), t.definitionId(), t.version(), t.level(),
                    t.previousLevel(), t.assetId(), place.tripId(), t.measure(), place.latitude(),
                    place.longitude(), place.speedKmh(), null, null, null);
            publish(type(t.kind()), tenantCode, t.at(), data, t.state() != SymptomState.ACTIVE);
        }
    }

    /** An operator closed the case. */
    public void closedByOperator(String tenantCode, EngineCase c, String actor, Instant at) {
        publish(SymptomEventCatalog.CLOSED, tenantCode, at, new SymptomCaseData(c.symptomId(), c.definitionId(),
                c.version(), c.level(), c.level(), c.assetId(), c.tripId(), null, c.latitude(), c.longitude(),
                c.speedKmh(), actor, null, null), false);
    }

    /** The case stayed unattended past its level's SLA. */
    public void slaExpired(String tenantCode, EngineCase c, int slaMinutes, Instant levelSince, Instant at) {
        publish(SymptomEventCatalog.SLA_EXPIRED, tenantCode, at, new SymptomCaseData(c.symptomId(),
                c.definitionId(), c.version(), c.level(), c.level(), c.assetId(), c.tripId(), null, c.latitude(),
                c.longitude(), c.speedKmh(), null, slaMinutes, levelSince), false);
    }

    private void publish(String type, String tenantCode, Instant at, SymptomCaseData data, boolean test) {
        OperationalEvent event = new OperationalEvent(type, SymptomEventCatalog.SOURCE, tenantCode, at,
                new EventContext(SymptomEventCatalog.CONTEXT_KIND, String.valueOf(data.symptomId())), data, test);
        try {
            fire.apply(event).exceptionally(e -> {
                LOG.warnf("Symptom event %s for case %d: an observer failed (%s)", type, data.symptomId(),
                        e.getClass().getSimpleName());
                return null;
            });
        } catch (RuntimeException e) {
            LOG.warnf("Symptom event %s for case %d not published (%s)", type, data.symptomId(),
                    e.getClass().getSimpleName());
        }
    }

    private static String type(Transition.Kind kind) {
        return switch (kind) {
            case OPENED -> SymptomEventCatalog.OPENED;
            case LEVEL_CHANGED -> SymptomEventCatalog.LEVEL_CHANGED;
            case CLOSED -> SymptomEventCatalog.CLOSED;
        };
    }
}
