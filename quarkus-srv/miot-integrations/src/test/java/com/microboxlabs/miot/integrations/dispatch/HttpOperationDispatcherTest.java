package com.microboxlabs.miot.integrations.dispatch;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.IntegrationEventBinding;
import com.microboxlabs.miot.integrations.service.IntegrationOperationInvoker;
import com.microboxlabs.miot.integrations.service.OperationInvocationResult;
import java.time.OffsetDateTime;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Body classification: a binding with response conditions holds a 2xx answer to its own
 * verdict — partners that reject inside an HTTP 200 park or retry instead of reading as
 * delivered. Without conditions, the status code stays the whole story.
 */
class HttpOperationDispatcherTest {

    private static final String TENANT = "tenant-1";

    private static IntegrationEventBinding binding(Map<String, Object> responseConditions) {
        return new IntegrationEventBinding(
                "b-1", TENANT, "org-1", "some.event", null, null,
                "11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222",
                Map.of(), Map.of("f", "{{task.v}}"), Map.of(), Map.of(), responseConditions,
                true, OffsetDateTime.now(), OffsetDateTime.now(), "a", "a");
    }

    private static final Map<String, Object> ALERTING_CONDITIONS = Map.of(
            "success", Map.of("response.code", "OK"),
            "retry", Map.of("response.code", "ERROR_AUTH"));

    private static HttpOperationDispatcher dispatcher(OperationInvocationResult result) {
        return new HttpOperationDispatcher(new IntegrationOperationInvoker(null, null, null, 20) {
            @Override
            public OperationInvocationResult invoke(
                    String tenantCode, String connectionId, String operationId, Object body) {
                return result;
            }
        });
    }

    @Test
    void withoutConditionsA2xxIsDelivered() {
        var outcome = dispatcher(new OperationInvocationResult(200, "{\"code\":\"ANYTHING\"}"))
                .dispatch(TENANT, binding(Map.of()), Map.of());
        assertTrue(outcome.success());
    }

    @Test
    void successConditionAcceptsTheMatchingBody() {
        var outcome = dispatcher(new OperationInvocationResult(200, "{\"code\":\"OK\"}"))
                .dispatch(TENANT, binding(ALERTING_CONDITIONS), Map.of());
        assertTrue(outcome.success());
    }

    @Test
    void aBodyRejectionParks() {
        var outcome = dispatcher(new OperationInvocationResult(
                200, "{\"code\":\"ERROR_ACTION\",\"message\":\"refused\"}"))
                .dispatch(TENANT, binding(ALERTING_CONDITIONS), Map.of());
        assertFalse(outcome.success());
        assertFalse(outcome.retryable(), "a body rejection meets the same answer on every retry");
    }

    @Test
    void aTransientBodyRejectionRetries() {
        var outcome = dispatcher(new OperationInvocationResult(200, "{\"code\":\"ERROR_AUTH\"}"))
                .dispatch(TENANT, binding(ALERTING_CONDITIONS), Map.of());
        assertFalse(outcome.success());
        assertTrue(outcome.retryable(), "the operator marked this rejection as transient");
    }

    @Test
    void anUnreadableBodyParksWhenConditionsAreConfigured() {
        var outcome = dispatcher(new OperationInvocationResult(200, "<html>gateway</html>"))
                .dispatch(TENANT, binding(ALERTING_CONDITIONS), Map.of());
        assertFalse(outcome.success());
        assertFalse(outcome.retryable(), "a body with no verdict cannot be classified as delivered");
    }

    @Test
    void httpFailuresKeepStatusClassificationRegardlessOfConditions() {
        var transientOutcome = dispatcher(new OperationInvocationResult(503, "down"))
                .dispatch(TENANT, binding(ALERTING_CONDITIONS), Map.of());
        assertFalse(transientOutcome.success());
        assertTrue(transientOutcome.retryable());

        var permanentOutcome = dispatcher(new OperationInvocationResult(400, "bad"))
                .dispatch(TENANT, binding(ALERTING_CONDITIONS), Map.of());
        assertFalse(permanentOutcome.success());
        assertFalse(permanentOutcome.retryable());
    }
}
