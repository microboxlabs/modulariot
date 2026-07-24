package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * URL assembly and response classification — the two pieces of the invoker that decide
 * where a call goes and what its answer means. The HTTP send itself needs a live socket
 * (no mocking framework in this module) and is covered by the connection test path.
 */
class IntegrationOperationInvokerTest {

    @Test
    void joinsBaseUrlAndPathWithExactlyOneSlash() {
        assertEquals(URI.create("https://api.example.com/v1/photos"),
                IntegrationOperationInvoker.buildUrl(
                        URI.create("https://api.example.com"), "/v1/photos", Map.of()));

        // A trailing slash on the base and a leading one on the path must not double up.
        assertEquals(URI.create("https://api.example.com/v1/photos"),
                IntegrationOperationInvoker.buildUrl(
                        URI.create("https://api.example.com/"), "/v1/photos", Map.of()));

        // ...nor may both be missing one.
        assertEquals(URI.create("https://api.example.com/v1/photos"),
                IntegrationOperationInvoker.buildUrl(
                        URI.create("https://api.example.com"), "v1/photos", Map.of()));
    }

    @Test
    void keepsABasePathPrefix() {
        assertEquals(URI.create("https://api.example.com/api/v1/photos"),
                IntegrationOperationInvoker.buildUrl(
                        URI.create("https://api.example.com/api"), "/v1/photos", Map.of()));
    }

    @Test
    void appendsAuthQueryParamsAfterAnExistingQueryString() {
        URI url = IntegrationOperationInvoker.buildUrl(
                URI.create("https://api.example.com"), "/photos?state=new", Map.of("api_key", "k1"));

        assertEquals("https://api.example.com/photos?state=new&api_key=k1", url.toString());
    }

    @Test
    void startsTheQueryStringWhenThePathHasNone() {
        URI url = IntegrationOperationInvoker.buildUrl(
                URI.create("https://api.example.com"), "/photos", Map.of("api_key", "k1"));

        assertEquals("https://api.example.com/photos?api_key=k1", url.toString());
    }

    @Test
    void encodesQueryParamNamesAndValues() {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("api key", "a+b c&d");

        URI url = IntegrationOperationInvoker.buildUrl(
                URI.create("https://api.example.com"), "/photos", params);

        assertEquals("https://api.example.com/photos?api+key=a%2Bb+c%26d", url.toString());
    }

    @Test
    void toleratesAnEmptyPath() {
        assertEquals(URI.create("https://api.example.com"),
                IntegrationOperationInvoker.buildUrl(URI.create("https://api.example.com"), "", Map.of()));
    }

    @Test
    void refusesAConnectionWithNoBaseUrl() {
        assertThrows(OperationInvocationException.class,
                () -> IntegrationOperationInvoker.buildUrl(null, "/photos", Map.of()));
    }

    @Test
    void classifies2xxAsSuccessful() {
        assertTrue(new OperationInvocationResult(200, "{}").successful());
        assertTrue(new OperationInvocationResult(204, "").successful());
        assertFalse(new OperationInvocationResult(400, "{}").successful());
    }

    @Test
    void onlyServerFaultsAndBackpressureAreRetryable() {
        assertTrue(new OperationInvocationResult(500, "").retryable());
        assertTrue(new OperationInvocationResult(503, "").retryable());
        // 4xx by number, but both explicitly mean "later", not "never".
        assertTrue(new OperationInvocationResult(408, "").retryable());
        assertTrue(new OperationInvocationResult(429, "").retryable());

        // A malformed or rejected request fails identically however often it is resent.
        assertFalse(new OperationInvocationResult(400, "").retryable());
        assertFalse(new OperationInvocationResult(401, "").retryable());
        assertFalse(new OperationInvocationResult(404, "").retryable());
        assertFalse(new OperationInvocationResult(422, "").retryable());
    }

    @Test
    void summaryCarriesTheProvidersReasonButIsCapped() {
        assertEquals("HTTP 404", new OperationInvocationResult(404, "   ").summary());
        assertEquals("HTTP 422: GUID no existe",
                new OperationInvocationResult(422, "GUID no existe").summary());

        String summary = new OperationInvocationResult(500, "x".repeat(500)).summary();
        assertTrue(summary.endsWith("…"), summary);
        assertTrue(summary.length() < 350, "summary should be capped, was " + summary.length());
    }
}
