package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.IntegrationEventBinding;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.jobs.NonRetryableJobException;
import com.microboxlabs.miot.integrations.persistence.IntegrationEventBindingRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import com.microboxlabs.miot.integrations.template.PayloadRenderer;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class EventBindingFetchServiceTest {

    private static final String TENANT = "tenant-1";
    private static final String EVENT = "calendar.resource_enrichment";
    private static final String CONNECTION = "11111111-1111-1111-1111-111111111111";
    private static final String OPERATION = "22222222-2222-2222-2222-222222222222";

    private final FakeBindings bindings = new FakeBindings();
    private final FakeOperations operations = new FakeOperations();
    private final FakeInvoker invoker = new FakeInvoker();

    private EventBindingFetchService service() {
        return new EventBindingFetchService(bindings, operations, invoker, new PayloadRenderer());
    }

    /** The AMS shape in miniature: identifiers in, ids out, renamed on the way back. */
    private static IntegrationEventBinding binding(String id, String scopeKind, String scopeKey) {
        return new IntegrationEventBinding(
                id, TENANT, "org-1", EVENT, scopeKind, scopeKey,
                CONNECTION, OPERATION,
                Map.of(),
                Map.of("p_driver_rut", "{{resourceData.mintral_driver1Rut}}",
                        "p_truck_plate", "{{resourceData.mintral_truckLicensePlate}}"),
                Map.of("assignedDriver", "{{response.driver_id}}",
                        "assignedTruck", "{{response.truck_id}}"),
                Map.of(), Map.of(),
                true,
                OffsetDateTime.now(), OffsetDateTime.now(), "a", "a");
    }

    private static Map<String, Object> payloadWithIdentity() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("mintral_driver1Rut", "11222333-4");
        data.put("mintral_truckLicensePlate", "ABCD12");
        return Map.of("resourceData", data);
    }

    @Test
    void noBindingMeansNotConfiguredNotAnError() {
        bindings.armed = List.of();

        assertTrue(service().fetch(TENANT, EVENT, "calendar", "cal-1", payloadWithIdentity()).isEmpty());
        assertEquals(0, invoker.calls);
    }

    @Test
    void payloadWithNothingToResolveSkipsTheCall() {
        bindings.armed = List.of(binding("b-1", null, null));

        // A bare pre-enrichment payload: no identity keys, so the rendered request is empty.
        var fetched = service().fetch(TENANT, EVENT, "calendar", "cal-1",
                Map.of("resourceData", Map.of("origen", "SCL")));

        assertTrue(fetched.isEmpty());
        assertEquals(0, invoker.calls);
    }

    @Test
    void rendersInvokesAndMapsTheResponse() {
        bindings.armed = List.of(binding("b-1", null, null));
        invoker.response = new OperationInvocationResult(200,
                "{\"driver_id\":\"d-uuid\",\"truck_id\":\"t-uuid\",\"trailer_id\":null}");

        var fetched = service().fetch(TENANT, EVENT, "calendar", "cal-1", payloadWithIdentity())
                .orElseThrow();

        assertEquals(Map.of("p_driver_rut", "11222333-4", "p_truck_plate", "ABCD12"), invoker.lastBody);
        // Renamed by response_templates; the null trailer slot writes nothing.
        assertEquals(Map.of("assignedDriver", "d-uuid", "assignedTruck", "t-uuid"), fetched.values());
        assertEquals("b-1", fetched.bindingId());
        // ...but the mapping still owns every key it declares, so a merger can
        // tell "resolved to nothing" apart from "never spoke for this key".
        assertEquals(Set.of("assignedDriver", "assignedTruck"), fetched.mappedKeys());
    }

    @Test
    void aScopedBindingBeatsAnEveryScopeOne() {
        bindings.armed = List.of(binding("b-global", null, null), binding("b-cal1", "calendar", "cal-1"));
        invoker.response = new OperationInvocationResult(200, "{\"driver_id\":\"d\"}");

        var fetched = service().fetch(TENANT, EVENT, "calendar", "cal-1", payloadWithIdentity())
                .orElseThrow();

        assertEquals("b-cal1", fetched.bindingId());
    }

    @Test
    void twoBindingsAtTheSameSpecificityPark() {
        bindings.armed = List.of(binding("b-1", null, null), binding("b-2", null, null));

        assertThrows(NonRetryableJobException.class,
                () -> service().fetch(TENANT, EVENT, "calendar", "cal-1", payloadWithIdentity()));
    }

    @Test
    void conditionGatesTheBinding() {
        IntegrationEventBinding gated = new IntegrationEventBinding(
                "b-1", TENANT, "org-1", EVENT, null, null, CONNECTION, OPERATION,
                Map.of("resourceData.mintral_serviceKind", "rampla"),
                Map.of("p_driver_rut", "{{resourceData.mintral_driver1Rut}}"),
                Map.of(), Map.of(), Map.of(), true, OffsetDateTime.now(), OffsetDateTime.now(), "a", "a");
        bindings.armed = List.of(gated);

        assertTrue(service().fetch(TENANT, EVENT, "calendar", "cal-1", payloadWithIdentity()).isEmpty());
    }

    @Test
    void serverErrorsAreRetryable() {
        bindings.armed = List.of(binding("b-1", null, null));
        invoker.response = new OperationInvocationResult(503, "unavailable");

        IllegalStateException failure = assertThrows(IllegalStateException.class,
                () -> service().fetch(TENANT, EVENT, "calendar", "cal-1", payloadWithIdentity()));
        assertTrue(failure.getMessage().contains("503"));
    }

    @Test
    void clientErrorsPark() {
        bindings.armed = List.of(binding("b-1", null, null));
        invoker.response = new OperationInvocationResult(400, "bad request");

        assertThrows(NonRetryableJobException.class,
                () -> service().fetch(TENANT, EVENT, "calendar", "cal-1", payloadWithIdentity()));
    }

    @Test
    void nonObjectResponsesPark() {
        bindings.armed = List.of(binding("b-1", null, null));
        invoker.response = new OperationInvocationResult(200, "[1,2,3]");

        assertThrows(NonRetryableJobException.class,
                () -> service().fetch(TENANT, EVENT, "calendar", "cal-1", payloadWithIdentity()));
    }

    @Test
    void aMissingOperationParks() {
        bindings.armed = List.of(binding("b-1", null, null));
        operations.operation = null;

        assertThrows(NonRetryableJobException.class,
                () -> service().fetch(TENANT, EVENT, "calendar", "cal-1", payloadWithIdentity()));
    }

    @Test
    void noResponseTemplatesReturnsTheResponseAsIs() {
        IntegrationEventBinding raw = new IntegrationEventBinding(
                "b-1", TENANT, "org-1", EVENT, null, null, CONNECTION, OPERATION,
                Map.of(), Map.of("p_driver_rut", "{{resourceData.mintral_driver1Rut}}"),
                Map.of(), Map.of(), Map.of(), true, OffsetDateTime.now(), OffsetDateTime.now(), "a", "a");
        bindings.armed = List.of(raw);
        invoker.response = new OperationInvocationResult(200, "{\"driver_id\":\"d-uuid\"}");

        var fetched = service().fetch(TENANT, EVENT, "calendar", "cal-1", payloadWithIdentity())
                .orElseThrow();

        assertEquals(Map.of("driver_id", "d-uuid"), fetched.values());
        // A raw pass-through claims authority over nothing.
        assertTrue(fetched.mappedKeys().isEmpty());
    }

    /* ------------------------------------------------------------------ fakes */

    private static final class FakeBindings extends IntegrationEventBindingRepository {
        private List<IntegrationEventBinding> armed = List.of();

        private FakeBindings() {
            super(null);
        }

        @Override
        public List<IntegrationEventBinding> listArmed(String tenantClientId, String eventType) {
            return armed;
        }
    }

    private static final class FakeOperations extends IntegrationOperationRepository {
        private IntegrationOperation operation = new IntegrationOperation(
                OPERATION, CONNECTION, "fn_resolve", "POST", "/rpc/fn_resolve",
                Map.of(), Map.of(), false);

        private FakeOperations() {
            super(null);
        }

        @Override
        public IntegrationOperation findByConnectionAndId(String connectionId, String operationId) {
            return operation;
        }
    }

    private static final class FakeInvoker extends IntegrationOperationInvoker {
        private OperationInvocationResult response = new OperationInvocationResult(200, "{}");
        private Object lastBody;
        private int calls;

        private FakeInvoker() {
            super(null, null, null, null, null, null);
        }

        @Override
        public OperationInvocationResult invoke(
                String tenantCode, String connectionId, String operationId, Object body) {
            calls++;
            lastBody = body;
            return response;
        }
    }
}
