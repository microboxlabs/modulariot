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
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

/** The IAM and IAM Credentials calls an organization's service account needs, as the platform. */
public class GoogleIamClient {

    static final String IAM = "https://iam.googleapis.com/v1/";
    static final String IAM_CREDENTIALS = "https://iamcredentials.googleapis.com/v1/";
    static final String RESOURCE_MANAGER = "https://cloudresourcemanager.googleapis.com/v1/";
    private static final String PROJECTS = "projects/";
    private static final String MEMBERS = "members";
    private static final Duration TIMEOUT = Duration.ofSeconds(15);
    private static final int POLICY_ATTEMPTS = 3;

    public record Account(String email, String uniqueId, String description, boolean disabled) {
    }

    public record AccessToken(String token, Instant expiresAt) {
    }

    private final HttpClient http;
    private final ObjectMapper json;
    private final Function<URI, Map<String, List<String>>> platformMetadata;
    private final String iamBase;
    private final String iamCredentials;
    private final String resourceManager;

    public GoogleIamClient(HttpClient http, ObjectMapper json, Function<URI, Map<String, List<String>>> platformMetadata) {
        this(http, json, platformMetadata, IAM, IAM_CREDENTIALS, RESOURCE_MANAGER);
    }

    GoogleIamClient(HttpClient http, ObjectMapper json, Function<URI, Map<String, List<String>>> platformMetadata, String iam,
            String iamCredentials, String resourceManager) {
        this.http = http;
        this.json = json;
        this.platformMetadata = platformMetadata;
        this.iamBase = iam;
        this.iamCredentials = iamCredentials;
        this.resourceManager = resourceManager;
    }

    /**
     * Adds the member to the role in the project's policy; nothing changes when it is
     * already there. A concurrent change to the policy is retried with the new etag.
     */
    public void grantProjectRole(String projectId, String member, String role) {
        String base = resourceManager + PROJECTS + encode(projectId);
        for (int attempt = 1; ; attempt++) {
            JsonNode policy = call("POST", base + ":getIamPolicy",
                    Map.of("options", Map.of("requestedPolicyVersion", 3)), "project policy read");
            if (!policy.isObject() || !policy.path("etag").isTextual()
                    || policy.path("etag").asText().isBlank()) {
                throw new GoogleCallException(502, "The project policy response had no etag");
            }
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
                for (JsonNode existing : binding.path(MEMBERS)) {
                    if (member.equals(existing.asText())) return false;
                }
                ((ObjectNode) binding).withArray(MEMBERS).add(member);
                return true;
            }
        }
        ObjectNode binding = bindings.addObject().put("role", role);
        binding.putArray(MEMBERS).add(member);
        if (policy.path("version").asInt(1) < 3) policy.put("version", 3);
        return true;
    }

    /** Throws a {@link GoogleCallException} with status 409 when the id is taken in the project. */
    public Account create(String projectId, String accountId, String displayName, String description) {
        Map<String, Object> body = Map.of(
                "accountId", accountId,
                "serviceAccount", Map.of("displayName", displayName, "description", description));
        return account(call("POST", iamBase + PROJECTS + encode(projectId) + "/serviceAccounts", body,
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
                iamCredentials + PROJECTS + "-/serviceAccounts/" + encode(email) + ":generateAccessToken",
                body, "access token");
        String token = answer.path("accessToken").asText();
        if (token.isBlank()) throw new GoogleCallException(502, "The access token response had no token");
        try {
            return new AccessToken(token, Instant.parse(answer.path("expireTime").asText()));
        } catch (DateTimeParseException e) {
            throw new GoogleCallException(502, "The access token response had no valid expiry", e);
        }
    }

    private String accountUrl(String projectId, String email) {
        return iamBase + PROJECTS + encode(projectId) + "/serviceAccounts/" + encode(email);
    }

    private JsonNode call(String method, String url, Object body, String what) {
        HttpRequest.BodyPublisher publisher;
        try {
            publisher = body == null ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body));
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
        URI uri = URI.create(url);
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri).timeout(TIMEOUT)
                .header("Content-Type", "application/json").method(method, publisher);
        platformMetadata.apply(uri).forEach((name, values) -> values.forEach(value -> builder.header(name, value)));
        HttpRequest request = builder.build();
        return GoogleCalls.send(http, json, request, what);
    }

    private static Account account(JsonNode node) {
        if (!node.path("email").isTextual() || node.path("email").asText().isBlank()
                || !node.path("uniqueId").isTextual() || node.path("uniqueId").asText().isBlank()) {
            throw new GoogleCallException(502, "The service account response had no email or unique id");
        }
        return new Account(node.path("email").asText(), node.path("uniqueId").asText(),
                node.path("description").asText(""), node.path("disabled").asBoolean(false));
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
