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

/** One membership change to send to an organization's Alfresco group. */
@Entity
@Table(name = "iam_projection_outbox", schema = "miot_iam")
public class IamProjectionChange extends PanacheEntityBase {

    public static final String MEMBER_ADDED = "MEMBER_ADDED";
    public static final String MEMBER_REMOVED = "MEMBER_REMOVED";
    public static final String PENDING = "PENDING";
    public static final String SYNCED = "SYNCED";
    public static final String FAILED = "FAILED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "organization_id", nullable = false)
    public Long organizationId;

    @Column(nullable = false)
    public String kind;

    @Column(name = "group_id", nullable = false)
    public String groupId;

    @Column(nullable = false)
    public String subject;

    @Column(nullable = false)
    public String status = PENDING;

    @Column(nullable = false)
    public int attempts;

    @Column(name = "last_error")
    public String lastError;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt = Instant.now();

    public static IamProjectionChange of(Long organizationId, String kind, String groupId, String subject) {
        IamProjectionChange c = new IamProjectionChange();
        c.organizationId = organizationId;
        c.kind = kind;
        c.groupId = groupId;
        c.subject = subject;
        return c;
    }

    public static Uni<List<IamProjectionChange>> pending(int limit) {
        return find("status = ?1 order by id", PENDING).page(0, limit).list();
    }

    public static Uni<List<IamProjectionChange>> forOrganization(Long organizationId, int limit) {
        return find("organizationId = ?1 order by id desc", organizationId).page(0, limit).list();
    }
}
