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

/** A group of members inside one organization. */
@Entity
@Table(name = "iam_team", schema = "miot_iam")
public class IamTeam extends PanacheEntityBase {

    @Id
    public UUID id;

    @Column(name = "organization_id", nullable = false)
    public Long organizationId;

    @Column(nullable = false)
    public String name;

    public String description;

    @Column(nullable = false)
    public String source = "NATIVE";

    @Column(name = "external_ref")
    public String externalRef;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt = Instant.now();

    @Column(name = "created_by")
    public String createdBy;

    public static Uni<List<IamTeam>> findByOrganization(Long organizationId) {
        return find("organizationId = ?1 order by lower(name)", organizationId).list();
    }

    public static Uni<IamTeam> findOne(Long organizationId, UUID id) {
        return find("organizationId = ?1 and id = ?2", organizationId, id).firstResult();
    }
}
