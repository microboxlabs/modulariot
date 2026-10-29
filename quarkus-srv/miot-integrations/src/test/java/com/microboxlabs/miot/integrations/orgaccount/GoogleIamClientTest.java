package com.microboxlabs.miot.integrations.orgaccount;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class GoogleIamClientTest {

    private record Call(String method, String path, String authorization, JsonNode body) {
    }

    private final ObjectMapper json = new ObjectMapper();
    private final List<Call> calls = new ArrayList<>();
    private HttpServer server;
    private int status;
    private String answer;
    private GoogleIamClient client;
    private String callsQuotaProject;

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            callsQuotaProject = exchange.getRequestHeaders().getFirst("x-goog-user-project");
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            calls.add(new Call(exchange.getRequestMethod(), exchange.getRequestURI().getRawPath(),
                    exchange.getRequestHeaders().getFirst("Authorization"),
                    body.isBlank() ? null : json.readTree(body)));
            byte[] out = answer.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, out.length);
            exchange.getResponseBody().write(out);
            exchange.close();
        });
        server.start();
        String base = "http://127.0.0.1:" + server.getAddress().getPort() + "/";
        client = new GoogleIamClient(HttpClient.newHttpClient(), json, uri -> Map.of("Authorization", List.of("Bearer platform-token"),
                        "x-goog-user-project", List.of("quota-demo")),
                base + "iam/", base + "creds/", base + "crm/");
        status = 200;
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    @Test
    void createsAnAccountAsThePlatform() {
        answer = "{\"email\":\"t-acme@tenants-p.iam.gserviceaccount.com\",\"uniqueId\":\"123\","
                + "\"description\":\"ModularIoT organization abc\"}";
        GoogleIamClient.Account account = client.create("tenants-p", "t-acme", "ModularIoT · Acme",
                "ModularIoT organization abc");
        assertEquals("t-acme@tenants-p.iam.gserviceaccount.com", account.email());
        assertEquals("123", account.uniqueId());
        assertFalse(account.disabled());
        Call call = calls.get(0);
        assertEquals("POST", call.method());
        assertEquals("/iam/projects/tenants-p/serviceAccounts", call.path());
        assertEquals("Bearer platform-token", call.authorization());
        assertEquals("quota-demo", callsQuotaProject);
        assertEquals("t-acme", call.body().path("accountId").asText());
        assertEquals("ModularIoT · Acme", call.body().path("serviceAccount").path("displayName").asText());
    }

    @Test
    void reportsGooglesStatusAndMessage() {
        status = 409;
        answer = "{\"error\":{\"code\":409,\"message\":\"Service account t-acme already exists\"}}";
        GoogleCallException error = assertThrows(GoogleCallException.class,
                () -> client.create("tenants-p", "t-acme", "x", "y"));
        assertEquals(409, error.status());
        assertTrue(error.getMessage().contains("already exists"));
    }

    @Test
    void anUnknownAccountIsEmpty() {
        status = 404;
        answer = "{\"error\":{\"code\":404,\"message\":\"Not found\"}}";
        assertTrue(client.find("tenants-p", "t-acme@tenants-p.iam.gserviceaccount.com").isEmpty());
        assertEquals("/iam/projects/tenants-p/serviceAccounts/t-acme%40tenants-p.iam.gserviceaccount.com",
                calls.get(0).path());
    }

    @Test
    void disablesAndEnables() {
        answer = "{}";
        client.disable("tenants-p", "t-acme@tenants-p.iam.gserviceaccount.com");
        client.enable("tenants-p", "t-acme@tenants-p.iam.gserviceaccount.com");
        assertTrue(calls.get(0).path().endsWith(":disable"));
        assertTrue(calls.get(1).path().endsWith(":enable"));
    }

    @Test
    void addsAMemberToAProjectRoleOnce() throws IOException {
        answer = "{\"version\":1,\"etag\":\"e1\",\"bindings\":[{\"role\":\"roles/owner\",\"members\":[\"user:a\"]}]}";
        client.grantProjectRole("tenants-p", "serviceAccount:t-acme@x", "roles/bigquery.jobUser");
        assertEquals("/crm/projects/tenants-p:getIamPolicy", calls.get(0).path());
        assertEquals(3, calls.get(0).body().path("options").path("requestedPolicyVersion").asInt());
        JsonNode sent = calls.get(1).body().path("policy");
        assertEquals("/crm/projects/tenants-p:setIamPolicy", calls.get(1).path());
        assertEquals("e1", sent.path("etag").asText());
        assertEquals(3, sent.path("version").asInt());
        assertEquals("roles/bigquery.jobUser", sent.path("bindings").get(1).path("role").asText());
        assertEquals("serviceAccount:t-acme@x", sent.path("bindings").get(1).path("members").get(0).asText());

        calls.clear();
        answer = json.writeValueAsString(sent);
        client.grantProjectRole("tenants-p", "serviceAccount:t-acme@x", "roles/bigquery.jobUser");
        assertEquals(1, calls.size());
    }

    @Test
    void impersonatesForAShortLivedToken() {
        answer = "{\"accessToken\":\"ya29.tenant\",\"expireTime\":\"2026-10-29T15:05:00Z\"}";
        GoogleIamClient.AccessToken token = client.impersonate("t-acme@tenants-p.iam.gserviceaccount.com",
                List.of("https://www.googleapis.com/auth/cloud-platform"), Duration.ofMinutes(5));
        assertEquals("ya29.tenant", token.token());
        assertEquals(Instant.parse("2026-10-29T15:05:00Z"), token.expiresAt());
        Call call = calls.get(0);
        assertEquals("/creds/projects/-/serviceAccounts/t-acme%40tenants-p.iam.gserviceaccount.com"
                + ":generateAccessToken", call.path());
        assertEquals("300s", call.body().path("lifetime").asText());
        assertEquals("https://www.googleapis.com/auth/cloud-platform", call.body().path("scope").get(0).asText());
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "not-json", "null", "{\"email\":\"test@example.com\"}",
            "{\"uniqueId\":\"123\"}"})
    void rejectsMalformedAccountResponses(String body) {
        answer = body;
        GoogleCallException error = assertThrows(GoogleCallException.class,
                () -> client.create("project-demo", "t-demo", "Demo", "synthetic"));
        assertEquals(502, error.status());
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "not-json", "[]"})
    void neverReplacesAPolicyWithoutItsEtag(String body) {
        answer = body;
        GoogleCallException error = assertThrows(GoogleCallException.class,
                () -> client.grantProjectRole("project-demo", "serviceAccount:demo@example.com", "roles/bigquery.jobUser"));
        assertEquals(502, error.status());
        assertEquals(1, calls.size());
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"accessToken\":\"synthetic\"}",
            "{\"accessToken\":\"synthetic\",\"expireTime\":\"bad\"}"})
    void mapsMalformedTokenExpiryToBadGateway(String body) {
        answer = body;
        List<String> scopes = List.of("scope");
        Duration lifetime = Duration.ofMinutes(5);
        GoogleCallException error = assertThrows(GoogleCallException.class,
                () -> client.impersonate("demo@example.com", scopes, lifetime));
        assertEquals(502, error.status());
    }
}
