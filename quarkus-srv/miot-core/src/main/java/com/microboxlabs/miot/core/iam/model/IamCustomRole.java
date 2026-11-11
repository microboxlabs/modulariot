package com.microboxlabs.miot.core.iam.model;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import io.smallrye.mutiny.Uni;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.TreeSet;
import java.util.UUID;

/** A role a top-level organization defines: a name and permissions from the access catalog. */
@Entity
@Table(name = "iam_custom_role", schema = "miot_iam")
public class IamCustomRole extends PanacheEntityBase {

    @Id
    public UUID id;

    @Column(name = "organization_id", nullable = false)
    public Long organizationId;

    @Column(name = "role_key", nullable = false)
    public String roleKey;

    @Column(name = "name_es", nullable = false)
    public String nameEs;

    @Column(name = "name_en", nullable = false)
    public String nameEn;

    @Column(name = "description_es")
    public String descriptionEs;

    @Column(name = "description_en")
    public String descriptionEn;

    @Column(name = "permission_keys", nullable = false)
    public String permissionKeys = "";

    @Column(name = "created_at", nullable = false)
    public Instant createdAt = Instant.now();

    @Column(name = "created_by")
    public String createdBy;

    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt = Instant.now();

    @Column(name = "updated_by")
    public String updatedBy;

    public static Uni<List<IamCustomRole>> findByOrganization(Long organizationId) {
        return find("organizationId = ?1 order by lower(nameEs)", organizationId).list();
    }

    public static Uni<List<IamCustomRole>> findByKeys(Long organizationId, Collection<String> roleKeys) {
        return roleKeys.isEmpty() ? Uni.createFrom().item(List.of())
                : find("organizationId = ?1 and roleKey in ?2", organizationId, roleKeys).list();
    }

    public static Uni<IamCustomRole> findOne(Long organizationId, UUID id) {
        return find("organizationId = ?1 and id = ?2", organizationId, id).firstResult();
    }

    /** The permission keys, sorted. */
    public List<String> permissions() {
        return permissionKeys == null || permissionKeys.isBlank()
                ? List.of()
                : Arrays.stream(permissionKeys.split(",")).map(String::trim).filter(k -> !k.isEmpty()).sorted()
                        .toList();
    }

    public void permissions(Collection<String> keys) {
        permissionKeys = String.join(",", new TreeSet<>(keys));
    }
}
