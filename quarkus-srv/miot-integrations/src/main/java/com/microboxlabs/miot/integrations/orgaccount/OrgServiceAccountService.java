package com.microboxlabs.miot.integrations.orgaccount;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Each organization's Google service account, in the project set by
 * {@code miot.integrations.org-accounts.project}. The account has no key and no
 * roles of its own here: what it may read is granted elsewhere.
 */
@ApplicationScoped
public class OrgServiceAccountService implements ManagedGoogleIdentity {

    static final String CHECK_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
    static final String JOB_USER = "roles/bigquery.jobUser";
    private static final int MAX_ID = 30;
    private static final int MIN_ID = 6;

    public static class NotConfiguredException extends RuntimeException {
        NotConfiguredException() {
            super("Organization service accounts are not configured");
        }
    }

    public static class NotFoundException extends RuntimeException {
        NotFoundException() {
            super("The organization has no service account");
        }
    }

    public record Check(boolean disabled, Instant tokenExpiresAt) {
    }

    private final OrgServiceAccountRepository repository;
    private final GoogleIamClient iam;
    private final Optional<String> project;
    private final String prefix;

    @Inject
    public OrgServiceAccountService(OrgServiceAccountRepository repository,
            @ConfigProperty(name = "miot.integrations.org-accounts.project") Optional<String> project,
            @ConfigProperty(name = "miot.integrations.org-accounts.prefix", defaultValue = "t-") String prefix) {
        this(repository, platformClient(), project, prefix);
    }

    OrgServiceAccountService(OrgServiceAccountRepository repository, GoogleIamClient iam,
            Optional<String> project, String prefix) {
        this.repository = repository;
        this.iam = iam;
        this.project = project.filter(p -> !p.isBlank());
        this.prefix = prefix;
    }

    private static GoogleIamClient platformClient() {
        HttpClient http = HttpClient.newHttpClient();
        ObjectMapper json = new ObjectMapper();
        PlatformGoogleToken token = PlatformGoogleToken.applicationDefault();
        return new GoogleIamClient(http, json, token::metadata);
    }

    public boolean configured() {
        return project.isPresent();
    }

    public Optional<String> projectId() {
        return project;
    }

    public Optional<OrgServiceAccount> find(String tenantCode) {
        return repository.find(tenantCode);
    }

    /** Idempotent: an organization keeps the account it was given first. */
    public OrgServiceAccount create(String tenantCode, String slug, String name, String actor) {
        String projectId = project.orElseThrow(NotConfiguredException::new);
        Optional<OrgServiceAccount> existing = repository.find(tenantCode);
        if (existing.isPresent()) return existing.get();
        String description = description(tenantCode);
        for (String accountId : accountIds(prefix, slug, tenantCode)) {
            Optional<GoogleIamClient.Account> account = createOrAdopt(projectId, accountId, name, description);
            if (account.isPresent()) {
                return repository.insert(new OrgServiceAccount(tenantCode, projectId, accountId,
                        account.get().email(), account.get().uniqueId(), account.get().disabled(),
                        null, actor, null, actor));
            }
        }
        throw new IllegalStateException("No free account id for organization " + slug);
    }

    /** The account with this id, created now or left by an earlier attempt; empty when another organization has it. */
    private Optional<GoogleIamClient.Account> createOrAdopt(String projectId, String accountId, String name,
            String description) {
        try {
            return Optional.of(iam.create(projectId, accountId, displayName(name), description));
        } catch (GoogleCallException e) {
            if (e.status() != 409) throw e;
        }
        return iam.find(projectId, accountId + "@" + projectId + ".iam.gserviceaccount.com")
                .filter(found -> description.equals(found.description()));
    }

    public OrgServiceAccount setDisabled(String tenantCode, boolean disabled, String actor) {
        OrgServiceAccount account = repository.find(tenantCode).orElseThrow(NotFoundException::new);
        if (disabled) {
            iam.disable(account.projectId(), account.email());
        } else {
            iam.enable(account.projectId(), account.email());
        }
        return repository.setDisabled(tenantCode, disabled, actor);
    }

    /** Proves the platform can act as the account by minting a token, which is not returned. */
    public Check check(String tenantCode) {
        OrgServiceAccount account = repository.find(tenantCode).orElseThrow(NotFoundException::new);
        if (account.disabled()) return new Check(true, null);
        GoogleIamClient.AccessToken token = iam.impersonate(account.email(), List.of(CHECK_SCOPE),
                Duration.ofMinutes(5));
        return new Check(false, token.expiresAt());
    }

    /** Lets the account run BigQuery jobs in the organizations' project, which then bills them. */
    public void allowQueries(String tenantCode) {
        OrgServiceAccount account = repository.find(tenantCode).orElseThrow(NotFoundException::new);
        iam.grantProjectRole(account.projectId(), "serviceAccount:" + account.email(), JOB_USER);
    }

    @Override
    public Map<String, Object> bind(String tenantCode, Map<String, Object> publicConfig) {
        OrgServiceAccount account = repository.find(tenantCode).orElseThrow(
                () -> new ManagedGoogleIdentityUnavailableException("The organization has no service account"));
        if (account.disabled()) throw new ManagedGoogleIdentityUnavailableException("The organization's service account is disabled");
        Map<String, Object> bound = new LinkedHashMap<>(publicConfig);
        bound.put(CLIENT_EMAIL, account.email());
        return bound;
    }

    @Override
    public Token accessToken(String email, String scope) {
        OrgServiceAccount account = repository.findByEmail(email).orElseThrow(
                () -> new ManagedGoogleIdentityUnavailableException("Not an organization's service account"));
        if (account.disabled()) throw new ManagedGoogleIdentityUnavailableException("The organization's service account is disabled");
        GoogleIamClient.AccessToken token = iam.impersonate(account.email(), List.of(scope), Duration.ofHours(1));
        return new Token(token.token(), token.expiresAt());
    }

    /** Matched on adoption, so an account another organization owns is never taken over. */
    static String description(String tenantCode) {
        return "ModularIoT organization " + tenantCode;
    }

    static String displayName(String name) {
        String full = "ModularIoT · " + (name == null || name.isBlank() ? "organization" : name.strip());
        return full.length() <= 100 ? full : full.substring(0, 100);
    }

    /**
     * Ids Google accepts ({@code [a-z][a-z0-9-]{4,28}[a-z0-9]}), readable first:
     * the prefix and slug, then the same with a hash of the tenant code.
     */
    static List<String> accountIds(String prefix, String slug, String tenantCode) {
        String hash = hash(tenantCode);
        String base = trimDashes(prefix + slug.toLowerCase().replaceAll("[^a-z0-9]+", "-"));
        Set<String> ids = new LinkedHashSet<>();
        if (base.length() >= MIN_ID && base.length() <= MAX_ID) ids.add(base);
        String stem = base.length() > MAX_ID - hash.length() - 1
                ? base.substring(0, MAX_ID - hash.length() - 1) : base;
        ids.add(trimDashes(stem) + "-" + hash);
        return List.copyOf(ids);
    }

    private static String trimDashes(String value) {
        StringBuilder normalized = new StringBuilder(value.length());
        boolean dash = false;
        for (int i = 0; i < value.length(); i++) {
            char current = value.charAt(i);
            if (current == '-') {
                dash = true;
            } else {
                if (dash) normalized.append('-');
                normalized.append(current);
                dash = false;
            }
        }
        return normalized.toString();
    }

    private static String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, 3);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
