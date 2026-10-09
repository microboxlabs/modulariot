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

/** A principal holds a module role on a scope of an organization. */
@Entity
@Table(name = "iam_role_binding", schema = "miot_iam")
public class IamRoleBinding extends PanacheEntityBase {

    public static final String USER = "USER";
    public static final String TEAM = "TEAM";
    public static final String SERVICE_ACCOUNT = "SERVICE_ACCOUNT";
    public static final String CLIENT = "CLIENT";
    public static final String ORGANIZATION = "ORGANIZATION";
    public static final String SUB_ACCOUNT = "SUB_ACCOUNT";

    @Id
    public UUID id;

    @Column(name = "organization_id", nullable = false)
    public Long organizationId;

    @Column(name = "principal_kind", nullable = false)
    public String principalKind;

    @Column(name = "principal_id", nullable = false)
    public String principalId;

    @Column(name = "role_key", nullable = false)
    public String roleKey;

    @Column(name = "scope_kind", nullable = false)
    public String scopeKind = ORGANIZATION;

    @Column(name = "scope_id", nullable = false)
    public String scopeId = "";

    @Column(name = "expires_at")
    public Instant expiresAt;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt = Instant.now();

    @Column(name = "created_by")
    public String createdBy;

    public IamRoleBinding() {
        // Required by JPA.
    }

    public static IamRoleBinding of(Long organizationId, String principalKind, String principalId, String roleKey,
            String actor) {
        IamRoleBinding b = new IamRoleBinding();
        b.id = UUID.randomUUID();
        b.organizationId = organizationId;
        b.principalKind = principalKind;
        b.principalId = principalId;
        b.roleKey = roleKey;
        b.createdBy = actor;
        return b;
    }

    /** Bindings of the principals on any of the organizations. */
    public static Uni<List<IamRoleBinding>> findFor(List<Long> organizationIds, String principalKind,
            List<String> principalIds) {
        if (principalIds.isEmpty()) {
            return Uni.createFrom().item(List.of());
        }
        return find("organizationId in ?1 and principalKind = ?2 and principalId in ?3",
                organizationIds, principalKind, principalIds).list();
    }

    public static Uni<List<IamRoleBinding>> findByRole(Long organizationId, String roleKey) {
        return find("organizationId = ?1 and roleKey = ?2", organizationId, roleKey).list();
    }

    public static Uni<List<IamRoleBinding>> findByOrganization(Long organizationId) {
        return find("organizationId = ?1", organizationId).list();
    }

    /** Granted on the whole organization and not expired. */
    public boolean organizationWide(Instant now) {
        return ORGANIZATION.equals(scopeKind) && (expiresAt == null || expiresAt.isAfter(now));
    }

    /** Whether this binding applies to {@code organizationId}, given the organization's parent. */
    public boolean covers(Long organizationId, Long parentId, Instant now) {
        if (expiresAt != null && !expiresAt.isAfter(now)) {
            return false;
        }
        if (SUB_ACCOUNT.equals(scopeKind)) {
            return String.valueOf(organizationId).equals(scopeId);
        }
        if (ORGANIZATION.equals(scopeKind)) {
            return organizationId.equals(this.organizationId) || this.organizationId.equals(parentId);
        }
        return false;
    }
}
