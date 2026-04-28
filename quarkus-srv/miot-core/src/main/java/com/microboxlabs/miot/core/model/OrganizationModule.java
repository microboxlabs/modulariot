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

/**
 * Per-organization product module entitlement.
 * Drives which application features an org can access at runtime
 * (FLEET_MANAGEMENT, DASHBOARDS, COLLABORATORS_MANAGEMENT, ...).
 *
 * Replaces the hardcoded per-module Alfresco groups (GROUP_FLEET_MANAGEMENT etc.)
 * as the source of truth for feature access. Alfresco groups keep their
 * original job: binding users to organizations (not to individual features).
 */
@Entity
@Table(name = "organization_modules", schema = "miot_core")
public class OrganizationModule extends PanacheEntityBase {

    @EmbeddedId
    public OrganizationModuleId id;

    @Column(nullable = false)
    public boolean enabled = true;

    public OrganizationModule() {
    }

    public OrganizationModule(Long organizationId, String moduleCode, boolean enabled) {
        this.id = new OrganizationModuleId(organizationId, moduleCode);
        this.enabled = enabled;
    }

    // --- Named finders ---

    public static Uni<List<OrganizationModule>> findByOrganization(Long organizationId) {
        return find("id.organizationId = ?1", organizationId).list();
    }

    public static Uni<List<OrganizationModule>> findEnabledByOrganization(Long organizationId) {
        return find("id.organizationId = ?1 and enabled = true", organizationId).list();
    }

    /**
     * Composite primary key (organization_id, module_code).
     */
    @Embeddable
    public static class OrganizationModuleId implements Serializable {

        @Column(name = "organization_id")
        public Long organizationId;

        @Column(name = "module_code")
        public String moduleCode;

        public OrganizationModuleId() {
        }

        public OrganizationModuleId(Long organizationId, String moduleCode) {
            this.organizationId = organizationId;
            this.moduleCode = moduleCode;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof OrganizationModuleId that)) return false;
            return Objects.equals(organizationId, that.organizationId)
                    && Objects.equals(moduleCode, that.moduleCode);
        }

        @Override
        public int hashCode() {
            return Objects.hash(organizationId, moduleCode);
        }
    }
}
