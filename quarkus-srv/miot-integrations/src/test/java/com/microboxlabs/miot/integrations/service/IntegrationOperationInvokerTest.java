package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.jobs.JobHttpTrace;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/**
 * URL assembly, response classification, and how a request is captured for the audit
 * trail — the pieces of the invoker that decide where a call goes, what its answer means,
 * and what gets recorded. The successful HTTP send needs a live socket (no mocking
 * framework in this module) and is covered by the connection test path; the pre-send
 * guard failure, which is where a request would otherwise go unrecorded, needs none.
 */
class IntegrationOperationInvokerTest {

    /** No test may leak a trace window onto a reused thread; the guard-path test opens one. */
    @AfterEach
    void closeAnyOpenTraceWindow() {
        JobHttpTrace.end();
    }

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

    @Test
    void recordedRequestHeadersMaskAuthButKeepTransportHeaders() {
        Map<String, String> auth = new LinkedHashMap<>();
        auth.put("Authorization", "Bearer super-secret-token");
        auth.put("X-Company-Key", "an-operator-named-api-key");

        Map<String, String> recorded =
                IntegrationOperationInvoker.recordedRequestHeaders(auth, true);

        // Every credential-bearing header is masked — including one whose name we could
        // not have guessed — while the transport headers we add stay in the clear.
        assertEquals("<redacted>", recorded.get("Authorization"));
        assertEquals("<redacted>", recorded.get("X-Company-Key"));
        assertEquals("application/json", recorded.get("Content-Type"));
        assertEquals("application/json", recorded.get("Accept"));
    }

    @Test
    void recordedRequestHeadersOmitContentTypeWhenThereIsNoBody() {
        Map<String, String> recorded =
                IntegrationOperationInvoker.recordedRequestHeaders(Map.of(), false);

        assertFalse(recorded.containsKey("Content-Type"), "a bodyless request sends no Content-Type");
        assertEquals("application/json", recorded.get("Accept"));
    }

    @Test
    void maskValuesKeepsKeysAndRedactsValues() {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("api_key", "k1");
        params.put("signature", "s1");

        Map<String, String> masked = IntegrationOperationInvoker.maskValues(params);

        assertEquals("<redacted>", masked.get("api_key"));
        assertEquals("<redacted>", masked.get("signature"));
    }

    @Test
    void recordsTheIntendedRequestWhenTheGuardRejectsTheHostBeforeSending() {
        // The exact production failure: the connection base URL resolves to an address the
        // SSRF guard refuses, so the request never leaves the process. Before this change the
        // attempt recorded nothing about the request — only a one-line error. It must now
        // carry the full (credential-masked) request so the console shows what would have been
        // sent. A loopback host trips the guard deterministically, with no DNS or socket.
        IntegrationOperationInvoker invoker = new IntegrationOperationInvoker(
                null, null, null, HttpClient.newHttpClient(), new ObjectMapper(), Duration.ofSeconds(2));
        ResolvedConnection connection =
                new ResolvedConnection("c1", URI.create("http://127.0.0.1"), Map.of(), Map.of());
        IntegrationOperation operation = new IntegrationOperation(
                "op1", "c1", "ActualizarEstadoFoto", "POST", "/api/photos", Map.of(), Map.of(), false);

        JobHttpTrace.begin();
        assertThrows(IllegalArgumentException.class,
                () -> invoker.execute(connection, operation, Map.of("aprobada", false)));
        List<Map<String, Object>> exchanges = JobHttpTrace.end();

        assertEquals(1, exchanges.size(), "the failed attempt still records one request");
        Map<String, Object> entry = exchanges.get(0);
        assertEquals("POST", entry.get("method"));
        assertEquals("http://127.0.0.1/api/photos", entry.get("url"));
        assertEquals("{\"aprobada\":false}", entry.get("requestBody"));
        assertNull(entry.get("status"), "nothing was sent, so there is no status");
        assertTrue(((String) entry.get("error")).contains("connection base URL"),
                "the guard's reason is recorded: " + entry.get("error"));
        @SuppressWarnings("unchecked")
        Map<String, Object> headers = (Map<String, Object>) entry.get("requestHeaders");
        assertEquals("application/json", headers.get("Content-Type"));
        assertEquals("application/json", headers.get("Accept"));
    }
}
