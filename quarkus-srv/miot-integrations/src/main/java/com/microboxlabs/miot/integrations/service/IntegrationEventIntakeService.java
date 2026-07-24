package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.AsyncJob;
import com.microboxlabs.miot.integrations.domain.IntegrationEventBinding;
import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsRequest;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsResponse;
import com.microboxlabs.miot.integrations.dto.IntegrationEventRequest;
import com.microboxlabs.miot.integrations.jobs.EventDispatchFeature;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import com.microboxlabs.miot.integrations.jobs.ModulithJobWorker;
import com.microboxlabs.miot.integrations.persistence.IntegrationEventBindingRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Turns an inbound event into async jobs — one per binding that wants it.
 *
 * <p>Bindings are resolved <b>here</b> rather than inside the job, so an event nobody
 * subscribes to costs one indexed read and leaves no row behind. Fanning out at intake also
 * means each channel retries independently: a partner API being down cannot hold up the
 * WhatsApp notification for the same verdict.
 *
 * <p>The producer stays ignorant of integrations entirely: it reports that something happened
 * and the modulith decides whether anything listens. That is what lets an operator bind a new
 * channel without a producer deploy.
 */
@ApplicationScoped
public class IntegrationEventIntakeService {

    private static final Logger LOG = Logger.getLogger(IntegrationEventIntakeService.class);

    private final IntegrationEventBindingRepository bindingRepository;
    private final AsyncJobService jobService;
    private final ModulithJobWorker worker;
    private final String sourceInstance;

    @Inject
    public IntegrationEventIntakeService(
            IntegrationEventBindingRepository bindingRepository,
            AsyncJobService jobService,
            ModulithJobWorker worker,
            @ConfigProperty(name = "miot.integrations.source-instance", defaultValue = "modulith")
            String sourceInstance) {
        this.bindingRepository = bindingRepository;
        this.jobService = jobService;
        this.worker = worker;
        this.sourceInstance = sourceInstance;
    }

    /**
     * @return the ids of the jobs enqueued; empty when no binding matched, which is the
     *         normal case for an event on an unconfigured scope
     */
    public List<String> accept(String tenantClientId, IntegrationEventRequest event) {
        if (event == null || event.eventType() == null || event.eventType().isBlank()) {
            throw new IllegalArgumentException("eventType is required");
        }
        Map<String, Object> context = event.context() == null ? Map.of() : event.context();

        List<IntegrationEventBinding> matching =
                bindingRepository.listArmed(tenantClientId, event.eventType().trim()).stream()
                        .filter(binding -> matchesScope(binding, event))
                        .filter(binding -> EventConditionMatcher.matches(binding.matchCondition(), context))
                        .toList();

        if (matching.isEmpty()) {
            LOG.debugf("No binding for event %s scope %s/%s on tenant %s",
                    event.eventType(), event.scopeKind(), event.scopeKey(), tenantClientId);
            return List.of();
        }

        List<AsyncJobSpec> specs = new ArrayList<>(matching.size());
        for (IntegrationEventBinding binding : matching) {
            specs.add(new AsyncJobSpec(
                    EventDispatchFeature.JOB_TYPE,
                    ModulithJobHandler.EXECUTOR,
                    event.scopeKey(),
                    null,
                    0,
                    dedupeKey(binding, event),
                    payloadFor(binding, event, context),
                    null));
        }

        EnqueueJobsResponse response = jobService.enqueue(
                tenantClientId, new EnqueueJobsRequest(sourceInstance, "listener", specs));
        // Fast path: drain now rather than waiting for the 30s reconciler tick.
        worker.onEnqueued(response);

        return response.created().stream().map(AsyncJob::id).toList();
    }

    /**
     * A binding with no {@code scopeKind} listens to every scope of its event type; one with a
     * scope listens only to that exact pair.
     */
    private static boolean matchesScope(IntegrationEventBinding binding, IntegrationEventRequest event) {
        if (binding.appliesToEveryScope()) {
            return true;
        }
        return binding.scopeKind().equals(event.scopeKind())
                && java.util.Objects.equals(binding.scopeKey(), event.scopeKey());
    }

    /**
     * Deterministic per (binding, event) so a redelivered verdict collapses on the ledger's
     * unique index instead of calling the partner twice. Falls back to the scope when the
     * producer supplies no key — weaker, but still better than none.
     */
    private static String dedupeKey(IntegrationEventBinding binding, IntegrationEventRequest event) {
        String eventKey = event.eventKey() == null || event.eventKey().isBlank()
                ? event.scopeKind() + ":" + event.scopeKey()
                : event.eventKey();
        String key = "evt:" + binding.id() + ":" + eventKey;
        // async_jobs.dedupe_key is VARCHAR(640); a truncated key still dedupes, an
        // over-long one would fail the insert outright.
        return key.length() <= 640 ? key : key.substring(0, 640);
    }

    private static Map<String, Object> payloadFor(
            IntegrationEventBinding binding, IntegrationEventRequest event, Map<String, Object> context) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put(EventDispatchFeature.PAYLOAD_TENANT_CLIENT_ID, binding.tenantClientId());
        payload.put(EventDispatchFeature.PAYLOAD_BINDING_ID, binding.id());
        payload.put(EventDispatchFeature.PAYLOAD_EVENT_TYPE, event.eventType());
        payload.put(EventDispatchFeature.PAYLOAD_SCOPE_KIND, event.scopeKind());
        payload.put(EventDispatchFeature.PAYLOAD_SCOPE_KEY, event.scopeKey());
        payload.put(EventDispatchFeature.PAYLOAD_CONTEXT, context);
        return payload;
    }
}
