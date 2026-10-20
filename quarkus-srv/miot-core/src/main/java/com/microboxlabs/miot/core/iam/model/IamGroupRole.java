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

/** An Alfresco group that stands for a module role in a top-level organization. */
@Entity
@Table(name = "iam_group_role", schema = "miot_iam")
public class IamGroupRole extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "organization_id", nullable = false)
    public Long organizationId;

    @Column(name = "group_id", nullable = false)
    public String groupId;

    @Column(name = "role_key", nullable = false)
    public String roleKey;

    @Column(nullable = false)
    public boolean projected;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt = Instant.now();

    @Column(name = "created_by")
    public String createdBy;

    public static IamGroupRole of(Long organizationId, String groupId, String roleKey, boolean projected,
            String actor) {
        IamGroupRole r = new IamGroupRole();
        r.organizationId = organizationId;
        r.groupId = groupId;
        r.roleKey = roleKey;
        r.projected = projected;
        r.createdBy = actor;
        return r;
    }

    public static Uni<List<IamGroupRole>> findByOrganization(Long organizationId) {
        return find("organizationId = ?1 order by groupId, roleKey", organizationId).list();
    }

    public static Uni<IamGroupRole> findOne(Long organizationId, String groupId, String roleKey) {
        return find("organizationId = ?1 and groupId = ?2 and roleKey = ?3", organizationId, groupId, roleKey)
                .firstResult();
    }

    public static Uni<List<IamGroupRole>> findProjected() {
        return find("projected = true order by organizationId, groupId").list();
    }
}
