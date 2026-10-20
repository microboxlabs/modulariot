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

/** An email domain whose people join a top-level organization at their first sign-in. */
@Entity
@Table(name = "iam_member_domain", schema = "miot_iam")
public class IamMemberDomain extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "organization_id", nullable = false)
    public Long organizationId;

    @Column(nullable = false)
    public String domain;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt = Instant.now();

    @Column(name = "created_by")
    public String createdBy;

    public static IamMemberDomain of(Long organizationId, String domain, String actor) {
        IamMemberDomain d = new IamMemberDomain();
        d.organizationId = organizationId;
        d.domain = domain;
        d.createdBy = actor;
        return d;
    }

    public static Uni<List<IamMemberDomain>> findByOrganization(Long organizationId) {
        return find("organizationId = ?1 order by domain", organizationId).list();
    }

    public static Uni<IamMemberDomain> findByDomain(String domain) {
        return find("domain", domain).firstResult();
    }
}
