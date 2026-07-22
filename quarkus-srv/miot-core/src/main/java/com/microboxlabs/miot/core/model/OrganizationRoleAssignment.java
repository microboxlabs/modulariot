package com.microboxlabs.miot.core.model;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import io.smallrye.mutiny.Uni;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.List;
import java.util.Objects;

/** An application role granted to an external subject within an organization. */
@Entity
@Table(name = "organization_role_assignments", schema = "miot_core")
public class OrganizationRoleAssignment extends PanacheEntityBase {

    @EmbeddedId
    public OrganizationRoleAssignmentId id;

    public OrganizationRoleAssignment() {
    }

    public OrganizationRoleAssignment(Long organizationId, String roleCode, String personId) {
        this.id = new OrganizationRoleAssignmentId(organizationId, roleCode, personId);
    }

    public static Uni<List<OrganizationRoleAssignment>> findAssignments(
            Long organizationId, String roleCode) {
        return find("id.organizationId = ?1 and id.roleCode = ?2", organizationId, roleCode).list();
    }

    public static Uni<Boolean> hasAssignment(
            Long organizationId, String roleCode, String personId) {
        return count(
                "id.organizationId = ?1 and id.roleCode = ?2 and id.personId = ?3",
                organizationId,
                roleCode,
                personId)
                .map(count -> count > 0);
    }

    @Embeddable
    public static class OrganizationRoleAssignmentId implements Serializable {

        @Column(name = "organization_id")
        public Long organizationId;

        @Column(name = "role_code")
        public String roleCode;

        @Column(name = "person_id")
        public String personId;

        public OrganizationRoleAssignmentId() {
        }

        public OrganizationRoleAssignmentId(Long organizationId, String roleCode, String personId) {
            this.organizationId = organizationId;
            this.roleCode = roleCode;
            this.personId = personId;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) return true;
            if (!(other instanceof OrganizationRoleAssignmentId that)) return false;
            return Objects.equals(organizationId, that.organizationId)
                    && Objects.equals(roleCode, that.roleCode)
                    && Objects.equals(personId, that.personId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(organizationId, roleCode, personId);
        }
    }
}
