package com.microboxlabs.miot.symptoms.events;

import com.microboxlabs.miot.core.event.EventContext;
import com.microboxlabs.miot.core.event.OperationalEvent;
import com.microboxlabs.miot.symptoms.cases.EngineCase;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomDefinition;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.store.SymptomCatalogStore;
import com.microboxlabs.miot.symptoms.evaluator.Transition;
import com.microboxlabs.miot.symptoms.evaluator.TransitionLog.Place;
import com.microboxlabs.miot.symptoms.evaluator.TransitionLog.Recorded;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import org.jboss.logging.Logger;

/**
 * Publishes the {@code symptom.case.*} events as {@link OperationalEvent}s, asynchronously, so a slow or failing
 * observer never holds the evaluator. The context is {@code {kind: "symptom_case", key: <symptom id>}}, the id
 * the Control Tower gives the case. TEST symptoms publish with {@code test} set. The symptom's key and name are
 * read from the catalog and kept for 30 s.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class SymptomEvents {

    private static final Logger LOG = Logger.getLogger(SymptomEvents.class);
    private static final Duration NAMES_TTL = Duration.ofSeconds(30);

    /** Publishes nothing. */
    public static final SymptomEvents NONE = new SymptomEvents(CompletableFuture::completedFuture);

    /** A symptom definition by tenant and id. */
    @FunctionalInterface
    public interface Definitions {
        Optional<SymptomDefinition> find(String tenantCode, UUID definitionId);
    }

    private record Name(Instant at, String key, String name) {
    }

    private final Function<OperationalEvent, CompletionStage<?>> fire;
    private final Definitions definitions;
    private final Clock clock;
    private final Map<String, Name> names = new ConcurrentHashMap<>();

    @Inject
    SymptomEvents(Event<OperationalEvent> bus, SymptomCatalogStore catalog) {
        this(bus::fireAsync, catalog::findDefinition, Clock.systemUTC());
    }

    /** Without the symptom's key and name. */
    public SymptomEvents(Function<OperationalEvent, CompletionStage<?>> fire) {
        this(fire, (tenant, id) -> Optional.empty(), Clock.systemUTC());
    }

    public SymptomEvents(Function<OperationalEvent, CompletionStage<?>> fire, Definitions definitions, Clock clock) {
        this.fire = fire;
        this.definitions = definitions;
        this.clock = clock;
    }

    /** One event per change the evaluator recorded. */
    public void transitions(String tenantCode, List<Recorded> recorded, Place place) {
        for (Recorded r : recorded) {
            Transition t = r.transition();
            Name n = name(tenantCode, t.definitionId());
            SymptomCaseData data = new SymptomCaseData(-r.caseId(), t.definitionId(), t.version(), n.key(),
                    n.name(), t.level(), t.previousLevel(), t.assetId(), place.tripId(), place.driverId(),
                    t.measure(), place.latitude(), place.longitude(), place.speedKmh(), null, null, null);
            publish(type(t.kind()), tenantCode, t.at(), data, t.state() != SymptomState.ACTIVE);
        }
    }

    /** An operator closed the case. */
    public void closedByOperator(String tenantCode, EngineCase c, String actor, Instant at) {
        Name n = name(tenantCode, c.definitionId());
        publish(SymptomEventCatalog.CLOSED, tenantCode, at, new SymptomCaseData(c.symptomId(), c.definitionId(),
                c.version(), n.key(), n.name(), c.level(), c.level(), c.assetId(), c.tripId(), null, null,
                c.latitude(), c.longitude(), c.speedKmh(), actor, null, null), false);
    }

    /** The case stayed unattended past its level's SLA. */
    public void slaExpired(String tenantCode, EngineCase c, int slaMinutes, Instant levelSince, Instant at) {
        Name n = name(tenantCode, c.definitionId());
        publish(SymptomEventCatalog.SLA_EXPIRED, tenantCode, at, new SymptomCaseData(c.symptomId(),
                c.definitionId(), c.version(), n.key(), n.name(), c.level(), c.level(), c.assetId(), c.tripId(),
                null, null, c.latitude(), c.longitude(), c.speedKmh(), null, slaMinutes, levelSince), false);
    }

    /** The symptom's key and name; both null when the catalog cannot be read, and the event still goes out. */
    private Name name(String tenantCode, UUID definitionId) {
        Instant now = clock.instant();
        String cacheKey = tenantCode + "/" + definitionId;
        Name cached = names.get(cacheKey);
        if (cached != null && !cached.at().plus(NAMES_TTL).isBefore(now)) {
            return cached;
        }
        try {
            Optional<SymptomDefinition> d = definitions.find(tenantCode, definitionId);
            Name fresh = new Name(now, d.map(SymptomDefinition::key).orElse(null),
                    d.map(SymptomDefinition::name).orElse(null));
            names.put(cacheKey, fresh);
            return fresh;
        } catch (RuntimeException e) {
            LOG.debugf("Symptom %s: name unavailable (%s)", definitionId, e.getClass().getSimpleName());
            return cached != null ? cached : new Name(now, null, null);
        }
    }

    private void publish(String type, String tenantCode, Instant at, SymptomCaseData data, boolean test) {
        OperationalEvent event = new OperationalEvent(type, SymptomEventCatalog.EVENT_SOURCE, tenantCode, at,
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
