package com.microboxlabs.miot.core.iam.model;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import io.smallrye.mutiny.Uni;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** An API key of a service account: {@code miot_sk_<keyId>_<secret>}. Only the secret's SHA-256 is stored. */
@Entity
@Table(name = "iam_api_key", schema = "miot_iam")
public class IamApiKey extends PanacheEntityBase {

    @Id
    public UUID id;

    @Column(name = "service_account_id", nullable = false)
    public UUID serviceAccountId;

    @Column(name = "key_id", nullable = false)
    public String keyId;

    @Column(name = "secret_hash", nullable = false)
    public String secretHash;

    public String name;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt = Instant.now();

    @Column(name = "created_by")
    public String createdBy;

    @Column(name = "expires_at")
    public Instant expiresAt;

    @Column(name = "last_used_at")
    public Instant lastUsedAt;

    @Column(name = "revoked_at")
    public Instant revokedAt;

    /** Not revoked and not expired. */
    public boolean usable(Instant now) {
        return revokedAt == null && (expiresAt == null || expiresAt.isAfter(now));
    }

    public static Uni<IamApiKey> byKeyId(String keyId) {
        return find("keyId = ?1", keyId).firstResult();
    }

    public static Uni<List<IamApiKey>> findByAccounts(List<UUID> accountIds) {
        return accountIds.isEmpty()
                ? Uni.createFrom().item(List.of())
                : find("serviceAccountId in ?1 order by createdAt", accountIds).list();
    }
}
