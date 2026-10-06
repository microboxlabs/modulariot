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

/** A machine principal owned by an organization; it authenticates with API keys. */
@Entity
@Table(name = "iam_service_account", schema = "miot_iam")
public class IamServiceAccount extends PanacheEntityBase {

    @Id
    public UUID id;

    @Column(name = "organization_id", nullable = false)
    public Long organizationId;

    @Column(nullable = false)
    public String name;

    public String description;

    @Column(nullable = false)
    public boolean disabled;

    /** The stored credential whose token this account's API keys are exchanged for; null for none. */
    @Column(name = "token_credential_ref")
    public String tokenCredentialRef;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt = Instant.now();

    @Column(name = "created_by")
    public String createdBy;

    public static Uni<List<IamServiceAccount>> findByOrganization(Long organizationId) {
        return find("organizationId = ?1 order by lower(name)", organizationId).list();
    }

    public static Uni<IamServiceAccount> findOne(Long organizationId, UUID id) {
        return find("organizationId = ?1 and id = ?2", organizationId, id).firstResult();
    }
}
