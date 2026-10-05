package com.microboxlabs.miot.core.iam.model;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import io.smallrye.mutiny.Uni;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** A pending membership for an email. Only the token's SHA-256 is stored. */
@Entity
@Table(name = "iam_invitation", schema = "miot_iam")
public class IamInvitation extends PanacheEntityBase {

    public static final String PENDING = "PENDING";
    public static final String ACCEPTED = "ACCEPTED";
    public static final String REVOKED = "REVOKED";

    @Id
    public UUID id;

    @Column(name = "organization_id", nullable = false)
    public Long organizationId;

    @Column(nullable = false)
    public String email;

    @Column(name = "base_role", nullable = false)
    public String baseRole;

    /** Comma-separated module role keys. */
    @Column(name = "role_keys", nullable = false)
    public String roleKeys = "";

    @Column(name = "token_hash", nullable = false)
    public String tokenHash;

    @Column(nullable = false)
    public String status = PENDING;

    @Column(name = "expires_at", nullable = false)
    public Instant expiresAt;

    @Column(name = "invited_by")
    public String invitedBy;

    @Column(name = "accepted_by")
    public UUID acceptedBy;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt = Instant.now();

    public IamInvitation() {
    }

    public List<String> roles() {
        return roleKeys == null || roleKeys.isBlank() ? List.of() : Arrays.asList(roleKeys.split(","));
    }

    public void roles(Collection<String> keys) {
        roleKeys = String.join(",", keys);
    }

    /** Pending and not expired. */
    public boolean open(Instant now) {
        return PENDING.equals(status) && expiresAt.isAfter(now);
    }

    public static Uni<List<IamInvitation>> pendingFor(Long organizationId) {
        return find("organizationId = ?1 and status = ?2 order by createdAt desc", organizationId, PENDING).list();
    }

    public static Uni<IamInvitation> pendingFor(Long organizationId, String email) {
        return find("organizationId = ?1 and lower(email) = ?2 and status = ?3",
                organizationId, email, PENDING).firstResult();
    }

    public static Uni<List<IamInvitation>> pendingForEmail(String email) {
        return find("lower(email) = ?1 and status = ?2 order by createdAt", email, PENDING).list();
    }

    public static Uni<IamInvitation> byTokenHash(String tokenHash) {
        return find("tokenHash = ?1", tokenHash).firstResult();
    }
}
