package com.microboxlabs.miot.core.iam.model;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import io.smallrye.mutiny.Uni;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.List;

/** A role id carried in sign-in tokens, and the role it stands for in a top-level organization. */
@Entity
@Table(name = "iam_token_role", schema = "miot_iam")
public class IamTokenRole extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "organization_id", nullable = false)
    public Long organizationId;

    @Column(name = "external_id", nullable = false)
    public String externalId;

    @Column(name = "role_key", nullable = false)
    public String roleKey;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt = Instant.now();

    @Column(name = "created_by")
    public String createdBy;

    public static IamTokenRole of(Long organizationId, String externalId, String roleKey, String actor) {
        IamTokenRole r = new IamTokenRole();
        r.organizationId = organizationId;
        r.externalId = externalId;
        r.roleKey = roleKey;
        r.createdBy = actor;
        return r;
    }

    public static Uni<List<IamTokenRole>> findByOrganization(Long organizationId) {
        return find("organizationId = ?1 order by externalId", organizationId).list();
    }

    public static Uni<IamTokenRole> findOne(Long organizationId, String externalId) {
        return find("organizationId = ?1 and externalId = ?2", organizationId, externalId).firstResult();
    }
}
