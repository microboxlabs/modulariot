package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.iam.model.IamApiKey;
import com.microboxlabs.miot.core.iam.model.IamRoleBinding;
import com.microboxlabs.miot.core.iam.model.IamServiceAccount;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jboss.logging.Logger;

/**
 * Service accounts and their API keys. A key is {@code miot_sk_<keyId>_<secret>}: the key id finds the row, the
 * secret is compared by SHA-256. A service account is a member of its organization only, with the module roles bound
 * to it; it can never be Owner or Admin.
 */
@ApplicationScoped
@SuppressWarnings("java:S3252") // Reactive Panache generates finders and delete per entity.
public class ApiKeyService {

    public static final String PREFIX = "miot_sk_";
    static final Pattern FORMAT = Pattern.compile("miot_sk_([A-Za-z0-9]{12})_([A-Za-z0-9]{40})");
    static final Duration LAST_USED_RESOLUTION = Duration.ofMinutes(5);
    private static final String ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private static final Logger LOG = Logger.getLogger(ApiKeyService.class);

    public record KeyView(UUID id, String keyId, String name, Instant createdAt, String createdBy, Instant expiresAt,
            Instant lastUsedAt, Instant revokedAt) {
    }

    public record ServiceAccountView(UUID id, String name, String description, boolean disabled, List<String> roles,
            List<KeyView> keys, Instant createdAt, String createdBy, String tokenCredentialRef) {
    }

    /** {@code credentialRef}: a stored OAuth2 client_credentials credential of the organization, or null to unlink. */
    public record TokenCredentialRequest(String credentialRef) {
    }

    /** {@code secret} is the whole key, returned once. */
    public record CreatedKey(KeyView key, String secret) {
    }

    public record CreatedServiceAccount(ServiceAccountView serviceAccount, String secret) {
    }

    public record CreateServiceAccountRequest(String name, String description, List<String> roles,
            Integer expiresInDays) {
    }

    public record CreateKeyRequest(String name, Integer expiresInDays) {
    }

    /** Who a valid key belongs to. */
    public record Holder(UUID serviceAccountId, Long organizationId, String name) {
    }

    private final AccessEvaluator evaluator;
    private final IamDirectory directory;
    private final TokenExchange tokens;
    // Per bean, not static: a static SecureRandom would be built into the native image with a fixed seed.
    private final SecureRandom random = new SecureRandom();

    @Inject
    public ApiKeyService(AccessEvaluator evaluator, IamDirectory directory, TokenExchange tokens) {
        this.evaluator = evaluator;
        this.directory = directory;
        this.tokens = tokens;
    }

    public static boolean looksLikeKey(String token) {
        return token != null && token.startsWith(PREFIX);
    }

    /** The holder of a usable key, or null. Records the last use at most every few minutes. */
    public Uni<Holder> authenticate(String token) {
        Matcher m = FORMAT.matcher(token == null ? "" : token.trim());
        if (!m.matches()) {
            return Uni.createFrom().nullItem();
        }
        String keyId = m.group(1);
        String secretHash = sha256(m.group(2));
        Instant now = Instant.now();
        return Panache.withTransaction(() -> IamApiKey.byKeyId(keyId).flatMap(key -> matches(key, secretHash, now)
                ? holderOf(key, now)
                : Uni.createFrom().<Holder>nullItem()))
                .onFailure().recoverWithItem(e -> {
                    LOG.warnf(e, "API key %s could not be checked", keyId);
                    return null;
                });
    }

    private static boolean matches(IamApiKey key, String secretHash, Instant now) {
        return key != null && key.usable(now)
                && MessageDigest.isEqual(key.secretHash.getBytes(StandardCharsets.US_ASCII),
                        secretHash.getBytes(StandardCharsets.US_ASCII));
    }

    /** The key's enabled account as a holder, recording the key's last use at most every few minutes. */
    private static Uni<Holder> holderOf(IamApiKey key, Instant now) {
        return IamServiceAccount.<IamServiceAccount>findById(key.serviceAccountId).flatMap(account -> {
            if (account == null || account.disabled) {
                return Uni.createFrom().nullItem();
            }
            Holder holder = new Holder(account.id, account.organizationId, account.name);
            if (key.lastUsedAt != null && key.lastUsedAt.isAfter(now.minus(LAST_USED_RESOLUTION))) {
                return Uni.createFrom().item(holder);
            }
            key.lastUsedAt = now;
            return key.<IamApiKey>persist().replaceWith(holder);
        });
    }

    public Uni<List<ServiceAccountView>> list(String slug) {
        return Panache.withSession(() -> root(slug).flatMap(root -> IamServiceAccount.findByOrganization(root.id)
                .flatMap(accounts -> views(root.id, accounts))));
    }

    public Uni<CreatedServiceAccount> create(String slug, Caller actor, CreateServiceAccountRequest request) {
        if (request == null || request.name() == null || request.name().isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        Set<String> roles = new TreeSet<>(request.roles() == null ? List.of() : request.roles());
        Duration ttl = ttl(request.expiresInDays());
        return Panache.withTransaction(() -> root(slug).flatMap(root -> access(slug, actor).flatMap(access -> {
            TeamRules.checkGrant(access, roles, evaluator.registry());
            IamServiceAccount account = new IamServiceAccount();
            account.id = UUID.randomUUID();
            account.organizationId = root.id;
            account.name = request.name().trim();
            account.description = request.description();
            account.createdBy = actor.name();
            return account.<IamServiceAccount>persist()
                    .flatMap(saved -> bind(root.id, saved.id, roles, actor.name()))
                    .flatMap(ignored -> newKey(account.id, "default", ttl, actor.name()))
                    .flatMap(created -> directory.audit(root.id, actor.name(), "service-account.created",
                                    account.name, Map.of("roles", List.copyOf(roles)))
                            .flatMap(ignored -> view(root.id, account))
                            .map(view -> new CreatedServiceAccount(view, created.secret())));
        })));
    }

    public Uni<Void> delete(String slug, Caller actor, UUID accountId) {
        return Panache.withTransaction(() -> root(slug).flatMap(root -> account(root.id, accountId)
                .flatMap(account -> IamRoleBinding.delete("organizationId = ?1 and principalKind = ?2 "
                                + "and principalId = ?3", root.id, IamRoleBinding.SERVICE_ACCOUNT, account.id.toString())
                        .flatMap(ignored -> account.delete())
                        .flatMap(ignored -> directory.audit(root.id, actor.name(), "service-account.deleted",
                                account.name, Map.of())))));
    }

    public Uni<ServiceAccountView> setRoles(String slug, Caller actor, UUID accountId, List<String> requested) {
        Set<String> roles = new TreeSet<>(requested == null ? List.of() : requested);
        return Panache.withTransaction(() -> root(slug).flatMap(root -> access(slug, actor).flatMap(access ->
                account(root.id, accountId).flatMap(account -> {
                    TeamRules.checkGrant(access, roles, evaluator.registry());
                    return IamRoleBinding.delete("organizationId = ?1 and principalKind = ?2 and principalId = ?3 "
                                    + "and scopeKind = ?4", root.id, IamRoleBinding.SERVICE_ACCOUNT,
                                    account.id.toString(), IamRoleBinding.ORGANIZATION)
                            .flatMap(ignored -> bind(root.id, account.id, roles, actor.name()))
                            .flatMap(ignored -> directory.audit(root.id, actor.name(), "service-account.roles",
                                    account.name, Map.of("roles", List.copyOf(roles))))
                            .flatMap(ignored -> view(root.id, account));
                }))));
    }

    /** Links the credential whose token the account's API keys are exchanged for, or unlinks it. */
    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    public Uni<ServiceAccountView> setTokenCredential(String slug, Caller actor, UUID accountId,
            TokenCredentialRequest request) {
        String ref = request == null || request.credentialRef() == null || request.credentialRef().isBlank()
                ? null : request.credentialRef().trim();
        if (ref != null && !ref.matches("[A-Za-z0-9._:-]{1,255}")) {
            throw new IllegalArgumentException("Invalid credential reference");
        }
        return Panache.withTransaction(() -> root(slug).flatMap(root -> account(root.id, accountId)
                .flatMap(account -> {
                    account.tokenCredentialRef = ref;
                    tokens.forget(account.id);
                    return account.<IamServiceAccount>persist()
                            .flatMap(saved -> directory.audit(root.id, actor.name(), "service-account.token-credential",
                                    account.name, Map.of("credentialRef", ref == null ? "" : ref)))
                            .flatMap(ignored -> view(root.id, account));
                })));
    }

    public Uni<CreatedKey> createKey(String slug, Caller actor, UUID accountId, CreateKeyRequest request) {
        Duration ttl = ttl(request == null ? null : request.expiresInDays());
        String name = request == null || request.name() == null ? null : request.name().trim();
        return Panache.withTransaction(() -> root(slug).flatMap(root -> account(root.id, accountId)
                .flatMap(account -> newKey(account.id, name, ttl, actor.name())
                        .flatMap(created -> directory.audit(root.id, actor.name(), "api-key.created",
                                account.name, Map.of("keyId", created.key().keyId())).replaceWith(created)))));
    }

    public Uni<Void> revokeKey(String slug, Caller actor, UUID accountId, UUID keyId) {
        return Panache.withTransaction(() -> root(slug).flatMap(root -> account(root.id, accountId)
                .flatMap(account -> IamApiKey.<IamApiKey>findById(keyId).flatMap(key -> {
                    if (key == null || !key.serviceAccountId.equals(account.id)) {
                        throw new NoSuchElementException("API key not found");
                    }
                    key.revokedAt = Instant.now();
                    return key.<IamApiKey>persist()
                            .flatMap(saved -> directory.audit(root.id, actor.name(), "api-key.revoked",
                                    account.name, Map.of("keyId", key.keyId)));
                }))));
    }

    private Uni<CreatedKey> newKey(UUID accountId, String name, Duration ttl, String actor) {
        String keyId = random(random, 12);
        String secret = random(random, 40);
        IamApiKey key = new IamApiKey();
        key.id = UUID.randomUUID();
        key.serviceAccountId = accountId;
        key.keyId = keyId;
        key.secretHash = sha256(secret);
        key.name = name;
        key.createdBy = actor;
        key.expiresAt = ttl == null ? null : Instant.now().plus(ttl);
        return key.<IamApiKey>persist().map(saved -> new CreatedKey(view(saved), PREFIX + keyId + "_" + secret));
    }

    @SuppressWarnings("java:S1612") // PanacheEntityBase::persist is ambiguous with Reactive Panache overloads.
    private Uni<Void> bind(Long orgId, UUID accountId, Set<String> roles, String actor) {
        Uni<Void> chain = Uni.createFrom().voidItem();
        for (String role : roles) {
            chain = chain.flatMap(i -> IamRoleBinding.of(orgId, IamRoleBinding.SERVICE_ACCOUNT, accountId.toString(),
                    role, actor).persist().replaceWithVoid());
        }
        return chain;
    }

    private Uni<List<ServiceAccountView>> views(Long orgId, List<IamServiceAccount> accounts) {
        List<UUID> ids = accounts.stream().map(a -> a.id).toList();
        Instant now = Instant.now();
        return IamApiKey.findByAccounts(ids).flatMap(keys -> IamRoleBinding.findByOrganization(orgId).map(bindings -> {
            List<ServiceAccountView> out = new ArrayList<>();
            for (IamServiceAccount a : accounts) {
                List<String> roles = bindings.stream()
                        .filter(b -> IamRoleBinding.SERVICE_ACCOUNT.equals(b.principalKind)
                                && b.principalId.equals(a.id.toString()) && b.organizationWide(now))
                        .map(b -> b.roleKey).sorted().toList();
                List<KeyView> own = keys.stream().filter(k -> k.serviceAccountId.equals(a.id))
                        .map(ApiKeyService::view).toList();
                out.add(new ServiceAccountView(a.id, a.name, a.description, a.disabled, roles, own, a.createdAt,
                        a.createdBy, a.tokenCredentialRef));
            }
            return out;
        }));
    }

    private Uni<ServiceAccountView> view(Long orgId, IamServiceAccount account) {
        return views(orgId, List.of(account)).map(list -> list.get(0));
    }

    static KeyView view(IamApiKey k) {
        return new KeyView(k.id, k.keyId, k.name, k.createdAt, k.createdBy, k.expiresAt, k.lastUsedAt, k.revokedAt);
    }

    private Uni<Access> access(String slug, Caller actor) {
        return evaluator.evaluate(slug, actor);
    }

    private static Uni<Organization> root(String slug) {
        return Organization.findBySlug(slug).flatMap(org -> {
            if (org == null) {
                throw new NoSuchElementException("Organization not found: " + slug);
            }
            return org.parent == null
                    ? Uni.createFrom().item(org)
                    : Organization.<Organization>findById(org.parent.id);
        });
    }

    private static Uni<IamServiceAccount> account(Long orgId, UUID id) {
        return IamServiceAccount.findOne(orgId, id).map(a -> {
            if (a == null) {
                throw new NoSuchElementException("Service account not found");
            }
            return a;
        });
    }

    /** Keys may not expire; when they do, within 1-365 days. */
    static Duration ttl(Integer days) {
        if (days == null) {
            return null;
        }
        if (days < 1 || days > 365) {
            throw new IllegalArgumentException("expiresInDays must be 1-365");
        }
        return Duration.ofDays(days);
    }

    static String random(SecureRandom random, int length) {
        StringBuilder out = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            out.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return out.toString();
    }

    static String sha256(String value) {
        return TeamService.hash(value);
    }
}
