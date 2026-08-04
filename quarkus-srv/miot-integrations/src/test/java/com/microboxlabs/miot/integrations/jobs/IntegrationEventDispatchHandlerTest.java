package com.microboxlabs.miot.integrations.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.dispatch.ChannelDispatcher;
import com.microboxlabs.miot.integrations.dispatch.ChannelDispatcherRegistry;
import com.microboxlabs.miot.integrations.dispatch.DispatchOutcome;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationEventBinding;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationEventBindingRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import com.microboxlabs.miot.integrations.template.PayloadRenderer;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class IntegrationEventDispatchHandlerTest {

    private static final String TENANT = "tenant-1";
    private static final String BINDING_ID = "b-1";
    private static final String CONNECTION_ID = "11111111-1111-1111-1111-111111111111";
    private static final String OPERATION_ID = "22222222-2222-2222-2222-222222222222";

    private final FakeBindings bindings = new FakeBindings();
    private final FakeConnections connections = new FakeConnections();
    private final FakeOperations operations = new FakeOperations();
    private final RecordingDispatcher dispatcher = new RecordingDispatcher();

    private IntegrationEventDispatchHandler handler() {
        return new IntegrationEventDispatchHandler(
                bindings, connections, operations,
                new com.microboxlabs.miot.integrations.service.EventBindingSelector(bindings),
                new ChannelDispatcherRegistry(List.of(dispatcher), dispatcher),
                new PayloadRenderer());
    }

    private static Map<String, Object> payload() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put(EventDispatchFeature.PAYLOAD_TENANT_CLIENT_ID, TENANT);
        payload.put(EventDispatchFeature.PAYLOAD_BINDING_ID, BINDING_ID);
        payload.put(EventDispatchFeature.PAYLOAD_CONTEXT, Map.of(
                "content", Map.of("mediaId", "19f8-a8ad"),
                "review", Map.of("verdict", false),
                "session", Map.of("user", "revisor.demo")));
        return payload;
    }

    @Test
    void rendersTheSnapshotAndDeliversItToTheChannel() {
        JobOutcome outcome = handler().handle(TENANT, payload());

        assertEquals(JobOutcome.SUCCEEDED, outcome.outcome());
        assertEquals("19f8-a8ad", dispatcher.lastPayloadMap().get("guidMultimedia"));
        // The reviewer, snapshotted at intake — a worker thread has no user to ask.
        assertEquals("revisor.demo", dispatcher.lastPayloadMap().get("usuarioRevisor"));
        assertEquals(Boolean.FALSE, dispatcher.lastPayloadMap().get("aprobado"));
    }

    @Test
    void skipsWhenTheBindingWasRemovedBetweenEnqueueAndDispatch() {
        bindings.binding = null;

        JobOutcome outcome = handler().handle(TENANT, payload());

        // The operator's later decision wins over the queued intent.
        assertEquals(JobOutcome.SKIPPED, outcome.outcome());
    }

    @Test
    void skipsWhenTheBindingWasDisarmed() {
        bindings.binding = binding(false);

        assertEquals(JobOutcome.SKIPPED, handler().handle(TENANT, payload()).outcome());
    }

    @Test
    void parksWhenThePayloadCannotBeBuilt() {
        // guidMultimedia is required but its variable resolves to nothing.
        bindings.binding = bindingWithTemplates(Map.of(
                "guidMultimedia", "{{content.missing}}", "aprobado", "{{review.verdict}}"));

        NonRetryableJobException failure = assertThrows(NonRetryableJobException.class,
                () -> handler().handle(TENANT, payload()));

        assertTrue(failure.getMessage().contains("guidMultimedia"), failure.getMessage());
    }

    @Test
    void parksOnAPermanentChannelRefusal() {
        dispatcher.outcome = DispatchOutcome.permanentFailure("HTTP 422: GUID no existe");

        NonRetryableJobException failure = assertThrows(NonRetryableJobException.class,
                () -> handler().handle(TENANT, payload()));

        assertTrue(failure.getMessage().contains("422"), failure.getMessage());
    }

    @Test
    void throwsSoTheLedgerRetriesATransientRefusal() {
        dispatcher.outcome = DispatchOutcome.transientFailure("HTTP 503");

        RuntimeException failure = assertThrows(RuntimeException.class,
                () -> handler().handle(TENANT, payload()));

        // Anything but NonRetryableJobException means "back off and try again".
        assertTrue(!(failure instanceof NonRetryableJobException), "503 must stay retryable");
    }

    @Test
    void parksAPayloadMissingItsIdentifiers() {
        assertThrows(NonRetryableJobException.class, () -> handler().handle(TENANT, Map.of()));
    }

    // --- event-addressed dispatch (no bindingId: the producer cannot read bindings) ---

    private static Map<String, Object> eventAddressedPayload() {
        Map<String, Object> payload = payload();
        payload.remove(EventDispatchFeature.PAYLOAD_BINDING_ID);
        payload.put(EventDispatchFeature.PAYLOAD_EVENT_TYPE, "review.verdict");
        payload.put(EventDispatchFeature.PAYLOAD_SCOPE_KIND, "activiti_task");
        payload.put(EventDispatchFeature.PAYLOAD_SCOPE_KEY, "wfship2:presentDriverTask");
        return payload;
    }

    @Test
    void selectsTheArmedBindingByEventAndDelivers() {
        bindings.armed = List.of(binding(true));

        JobOutcome outcome = handler().handle(TENANT, eventAddressedPayload());

        assertEquals(JobOutcome.SUCCEEDED, outcome.outcome());
        assertTrue(dispatcher.lastPayload instanceof Map<?, ?>, "the rendered body was delivered");
    }

    @Test
    void skipsWhenNothingIsArmedForTheEvent() {
        bindings.armed = List.of();

        JobOutcome outcome = handler().handle(TENANT, eventAddressedPayload());

        assertEquals(JobOutcome.SKIPPED, outcome.outcome());
    }

    @Test
    void parksWhenNeitherBindingNorEventTypeIsNamed() {
        Map<String, Object> payload = payload();
        payload.remove(EventDispatchFeature.PAYLOAD_BINDING_ID);

        assertThrows(NonRetryableJobException.class, () -> handler().handle(TENANT, payload));
    }

    @Test
    void claimsTheEventDispatchJobTypeOnTheModulithLane() {
        assertEquals("integration_event_dispatch", handler().jobType());
        assertTrue(handler().jobType().length() <= 64, "must fit async_jobs.job_type");
        assertEquals("modulith", ModulithJobHandler.EXECUTOR);
    }

    /* ---------------------------------------------------------------- fakes */

    private static IntegrationEventBinding binding(boolean enabled) {
        return bindingWith(enabled, Map.of(
                "guidMultimedia", "{{content.mediaId}}",
                "aprobado", "{{review.verdict}}",
                "usuarioRevisor", "{{session.user}}"));
    }

    private static IntegrationEventBinding bindingWithTemplates(Map<String, String> templates) {
        return bindingWith(true, templates);
    }

    private static IntegrationEventBinding bindingWith(boolean enabled, Map<String, String> templates) {
        return new IntegrationEventBinding(
                BINDING_ID, TENANT, "gama", "review.verdict", "activiti_task",
                "wfship2:presentDriverTask", CONNECTION_ID, OPERATION_ID,
                Map.of(), templates, Map.of(), Map.of(), Map.of(), enabled,
                OffsetDateTime.now(), OffsetDateTime.now(), "a", "a");
    }

    private static final class FakeBindings extends IntegrationEventBindingRepository {
        private IntegrationEventBinding binding = binding(true);
        private List<IntegrationEventBinding> armed = List.of();

        private FakeBindings() {
            super(null);
        }

        @Override
        public IntegrationEventBinding findActiveById(String tenantClientId, String id) {
            return binding;
        }

        @Override
        public List<IntegrationEventBinding> listArmed(String tenantClientId, String eventType) {
            return armed;
        }
    }

    private static final class FakeConnections extends IntegrationConnectionRepository {
        private FakeConnections() {
            super(null);
        }

        @Override
        public IntegrationConnection findByTenantAndId(String tenantCode, String connectionId) {
            return new IntegrationConnection(
                    CONNECTION_ID, TENANT, "Partner", ProviderType.CUSTOM_HTTP,
                    URI.create("https://api.example.com"), "cred-1",
                    ConnectionStatus.ACTIVE, null, null, Map.of());
        }
    }

    private static final class FakeOperations extends IntegrationOperationRepository {
        private FakeOperations() {
            super(null);
        }

        @Override
        public IntegrationOperation findByConnectionAndId(String connectionId, String operationId) {
            Map<String, Object> properties = new LinkedHashMap<>();
            properties.put("guidMultimedia", Map.of("type", "string"));
            properties.put("aprobado", Map.of("type", "boolean"));
            properties.put("usuarioRevisor", Map.of("type", "string"));
            return new IntegrationOperation(
                    OPERATION_ID, CONNECTION_ID, "ActualizarEstado", "POST", "/v1/estado",
                    Map.of("type", "object", "properties", properties,
                            "required", List.of("guidMultimedia", "aprobado")),
                    Map.of(), false);
        }
    }

    private static final class RecordingDispatcher implements ChannelDispatcher {
        private Object lastPayload;
        private DispatchOutcome outcome = DispatchOutcome.succeeded("HTTP 200");

        @Override
        public boolean supports(ProviderType providerType) {
            return true;
        }

        @Override
        public DispatchOutcome dispatch(
                String tenantClientId, IntegrationEventBinding binding, Object payload) {
            this.lastPayload = payload;
            return outcome;
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> lastPayloadMap() {
            return (Map<String, Object>) lastPayload;
        }
    }
}
