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
import java.util.Objects;

/** Authoritative per-organization switch for a Modulith permission. */
@Entity
@Table(name = "organization_permission_settings", schema = "miot_core")
public class OrganizationPermissionSetting extends PanacheEntityBase {

    @EmbeddedId
    public OrganizationPermissionSettingId id;

    @Column(nullable = false)
    public boolean enabled;

    @Column(name = "projection_status", nullable = false)
    public String projectionStatus = "PENDING";

    @Column(name = "projection_error")
    public String projectionError;

    @Column(name = "projected_at")
    public Instant projectedAt;

    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt = Instant.now();

    public OrganizationPermissionSetting() {
    }

    public OrganizationPermissionSetting(Long organizationId, String permissionCode) {
        this.id = new OrganizationPermissionSettingId(organizationId, permissionCode);
    }

    public static Uni<OrganizationPermissionSetting> findSetting(
            Long organizationId, String permissionCode) {
        return find("id.organizationId = ?1 and id.permissionCode = ?2",
                organizationId, permissionCode).firstResult();
    }

    @Embeddable
    public static class OrganizationPermissionSettingId implements Serializable {

        @Column(name = "organization_id")
        public Long organizationId;

        @Column(name = "permission_code")
        public String permissionCode;

        public OrganizationPermissionSettingId() {
        }

        public OrganizationPermissionSettingId(Long organizationId, String permissionCode) {
            this.organizationId = organizationId;
            this.permissionCode = permissionCode;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) return true;
            if (!(other instanceof OrganizationPermissionSettingId that)) return false;
            return Objects.equals(organizationId, that.organizationId)
                    && Objects.equals(permissionCode, that.permissionCode);
        }

        @Override
        public int hashCode() {
            return Objects.hash(organizationId, permissionCode);
        }
    }
}
