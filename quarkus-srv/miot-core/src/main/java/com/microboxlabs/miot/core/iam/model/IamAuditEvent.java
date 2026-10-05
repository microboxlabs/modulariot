package com.microboxlabs.miot.core.iam.model;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.Map;
import org.hibernate.annotations.ColumnTransformer;

/** One change to memberships, roles, invitations or keys. {@code detail} is a JSON object. */
@Entity
@Table(name = "iam_audit_event", schema = "miot_iam")
public class IamAuditEvent extends PanacheEntityBase {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "organization_id")
    public Long organizationId;

    public String actor;

    @Column(nullable = false)
    public String action;

    public String target;

    @ColumnTransformer(write = "?::jsonb")
    @Column(nullable = false, columnDefinition = "jsonb")
    public String detail = "{}";

    @Column(name = "created_at", nullable = false)
    public Instant createdAt = Instant.now();

    public IamAuditEvent() {
        // Required by JPA.
    }

    public static IamAuditEvent of(Long organizationId, String actor, String action, String target,
            Map<String, Object> detail) {
        IamAuditEvent e = new IamAuditEvent();
        e.organizationId = organizationId;
        e.actor = actor;
        e.action = action;
        e.target = target;
        e.detail = toJson(detail);
        return e;
    }

    public static Uni<List<IamAuditEvent>> latest(Long organizationId, int limit) {
        return find("organizationId = ?1 order by createdAt desc", organizationId).page(0, limit).list();
    }

    static String toJson(Map<String, Object> detail) {
        try {
            return JSON.writeValueAsString(detail == null ? Map.of() : detail);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("audit detail is not serializable", e);
        }
    }
}
