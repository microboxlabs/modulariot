package com.microboxlabs.miot.core.model;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import io.smallrye.mutiny.Uni;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

/** A platform-scope role granted to a person, independent of any organization. */
@Entity
@Table(name = "platform_role_assignments", schema = "miot_core")
public class PlatformRoleAssignment extends PanacheEntityBase {

    @EmbeddedId
    public PlatformRoleAssignmentId id;

    @Column(name = "created_at")
    public Instant createdAt;

    @Column(name = "created_by")
    public String createdBy;

    public PlatformRoleAssignment() {
    }

    public PlatformRoleAssignment(String roleCode, String personId, String createdBy) {
        this.id = new PlatformRoleAssignmentId(roleCode, personId);
        this.createdAt = Instant.now();
        this.createdBy = createdBy;
    }

    public static Uni<List<PlatformRoleAssignment>> findAssignments(String roleCode) {
        return find("id.roleCode = ?1", roleCode).list();
    }

    public static Uni<Boolean> hasAssignment(String roleCode, String personId) {
        return count("id.roleCode = ?1 and id.personId = ?2", roleCode, personId)
                .map(count -> count > 0);
    }

    @Embeddable
    public static class PlatformRoleAssignmentId implements Serializable {

        @Column(name = "role_code")
        public String roleCode;

        @Column(name = "person_id")
        public String personId;

        public PlatformRoleAssignmentId() {
        }

        public PlatformRoleAssignmentId(String roleCode, String personId) {
            this.roleCode = roleCode;
            this.personId = personId;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) return true;
            if (!(other instanceof PlatformRoleAssignmentId that)) return false;
            return Objects.equals(roleCode, that.roleCode)
                    && Objects.equals(personId, that.personId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(roleCode, personId);
        }
    }
}
