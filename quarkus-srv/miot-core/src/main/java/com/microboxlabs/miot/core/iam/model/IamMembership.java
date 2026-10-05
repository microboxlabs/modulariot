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

/** A user's membership of an organization, with its one base role. */
@Entity
@Table(name = "iam_membership", schema = "miot_iam")
public class IamMembership extends PanacheEntityBase {

    @Id
    public UUID id;

    @Column(name = "organization_id", nullable = false)
    public Long organizationId;

    @Column(name = "user_id", nullable = false)
    public UUID userId;

    @Column(name = "base_role", nullable = false)
    public String baseRole;

    @Column(nullable = false)
    public String status = "ACTIVE";

    @Column(nullable = false)
    public String source = "NATIVE";

    @Column(name = "created_at", nullable = false)
    public Instant createdAt = Instant.now();

    @Column(name = "created_by")
    public String createdBy;

    public IamMembership() {
    }

    public static IamMembership of(Long organizationId, UUID userId, String baseRole, String source, String actor) {
        IamMembership m = new IamMembership();
        m.id = UUID.randomUUID();
        m.organizationId = organizationId;
        m.userId = userId;
        m.baseRole = baseRole;
        m.source = source;
        m.createdBy = actor;
        return m;
    }

    public static Uni<List<IamMembership>> findFor(List<Long> organizationIds, UUID userId) {
        return find("organizationId in ?1 and userId = ?2 and status = 'ACTIVE'", organizationIds, userId).list();
    }

    public static Uni<IamMembership> findOne(Long organizationId, UUID userId) {
        return find("organizationId = ?1 and userId = ?2", organizationId, userId).firstResult();
    }

    public static Uni<List<IamMembership>> findByOrganization(Long organizationId) {
        return find("organizationId = ?1 order by createdAt", organizationId).list();
    }

    public static Uni<List<IamMembership>> findByRole(Long organizationId, String baseRole) {
        return find("organizationId = ?1 and baseRole = ?2 and status = 'ACTIVE'", organizationId, baseRole).list();
    }

    public static Uni<List<IamMembership>> findByUser(UUID userId) {
        return find("userId = ?1 and status = 'ACTIVE'", userId).list();
    }
}
