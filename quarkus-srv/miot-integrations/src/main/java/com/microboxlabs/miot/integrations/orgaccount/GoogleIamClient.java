package com.microboxlabs.miot.integrations.orgaccount;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

/** The IAM and IAM Credentials calls an organization's service account needs, as the platform. */
public class GoogleIamClient {

    static final String IAM = "https://iam.googleapis.com/v1/";
    static final String IAM_CREDENTIALS = "https://iamcredentials.googleapis.com/v1/";
    static final String RESOURCE_MANAGER = "https://cloudresourcemanager.googleapis.com/v1/";
    private static final Duration TIMEOUT = Duration.ofSeconds(15);
    private static final int POLICY_ATTEMPTS = 3;

    public record Account(String email, String uniqueId, String description, boolean disabled) {
    }

    public record AccessToken(String token, Instant expiresAt) {
    }

    private final HttpClient http;
    private final ObjectMapper json;
    private final Supplier<String> platformToken;
    private final String iam;
    private final String iamCredentials;
    private final String resourceManager;

    public GoogleIamClient(HttpClient http, ObjectMapper json, Supplier<String> platformToken) {
        this(http, json, platformToken, IAM, IAM_CREDENTIALS, RESOURCE_MANAGER);
    }

    GoogleIamClient(HttpClient http, ObjectMapper json, Supplier<String> platformToken, String iam,
            String iamCredentials, String resourceManager) {
        this.http = http;
        this.json = json;
        this.platformToken = platformToken;
        this.iam = iam;
        this.iamCredentials = iamCredentials;
        this.resourceManager = resourceManager;
    }

    /**
     * Adds the member to the role in the project's policy; nothing changes when it is
     * already there. A concurrent change to the policy is retried with the new etag.
     */
    public void grantProjectRole(String projectId, String member, String role) {
        String base = resourceManager + "projects/" + encode(projectId);
        for (int attempt = 1; ; attempt++) {
            JsonNode policy = call("POST", base + ":getIamPolicy",
                    Map.of("options", Map.of("requestedPolicyVersion", 3)), "project policy read");
            ObjectNode updated = policy.deepCopy();
            if (!addMember(updated, member, role)) return;
            try {
                call("POST", base + ":setIamPolicy", Map.of("policy", updated), "project policy update");
                return;
            } catch (GoogleCallException e) {
                if (e.status() != 409 || attempt >= POLICY_ATTEMPTS) throw e;
            }
        }
    }

    /** @return false when the member already holds the role without a condition */
    private boolean addMember(ObjectNode policy, String member, String role) {
        ArrayNode bindings = policy.withArray("bindings");
        for (JsonNode binding : bindings) {
            if (role.equals(binding.path("role").asText()) && !binding.has("condition")) {
                for (JsonNode existing : binding.path("members")) {
                    if (member.equals(existing.asText())) return false;
                }
                ((ObjectNode) binding).withArray("members").add(member);
                return true;
            }
        }
        ObjectNode binding = bindings.addObject().put("role", role);
        binding.putArray("members").add(member);
        if (policy.path("version").asInt(1) < 3) policy.put("version", 3);
        return true;
    }

    /** Throws a {@link GoogleCallException} with status 409 when the id is taken in the project. */
    public Account create(String projectId, String accountId, String displayName, String description) {
        Map<String, Object> body = Map.of(
                "accountId", accountId,
                "serviceAccount", Map.of("displayName", displayName, "description", description));
        return account(call("POST", iam + "projects/" + encode(projectId) + "/serviceAccounts", body,
                "service account creation"));
    }

    public Optional<Account> find(String projectId, String email) {
        try {
            return Optional.of(account(call("GET", accountUrl(projectId, email), null, "service account lookup")));
        } catch (GoogleCallException e) {
            if (e.status() == 404) return Optional.empty();
            throw e;
        }
    }

    public void disable(String projectId, String email) {
        call("POST", accountUrl(projectId, email) + ":disable", Map.of(), "service account disable");
    }

    public void enable(String projectId, String email) {
        call("POST", accountUrl(projectId, email) + ":enable", Map.of(), "service account enable");
    }

    /** A short-lived token for the account, minted by the platform impersonating it. */
    public AccessToken impersonate(String email, List<String> scopes, Duration lifetime) {
        Map<String, Object> body = Map.of("scope", scopes, "lifetime", lifetime.toSeconds() + "s");
        JsonNode answer = call("POST",
                iamCredentials + "projects/-/serviceAccounts/" + encode(email) + ":generateAccessToken",
                body, "access token");
        String token = answer.path("accessToken").asText();
        if (token.isBlank()) throw new GoogleCallException(502, "The access token response had no token");
        return new AccessToken(token, Instant.parse(answer.path("expireTime").asText()));
    }

    private String accountUrl(String projectId, String email) {
        return iam + "projects/" + encode(projectId) + "/serviceAccounts/" + encode(email);
    }

    private JsonNode call(String method, String url, Object body, String what) {
        HttpRequest.BodyPublisher publisher;
        try {
            publisher = body == null ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body));
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(TIMEOUT)
                .header("Authorization", "Bearer " + platformToken.get())
                .header("Content-Type", "application/json")
                .method(method, publisher)
                .build();
        return GoogleCalls.send(http, json, request, what);
    }

    private static Account account(JsonNode node) {
        return new Account(node.path("email").asText(), node.path("uniqueId").asText(),
                node.path("description").asText(""), node.path("disabled").asBoolean(false));
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
