package com.microboxlabs.miot.core.model;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import io.smallrye.mutiny.Uni;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.List;

/**
 * An organization is the multi-tenant unit for web users.
 * It maps a URL-friendly slug to:
 *   - alfrescoGroupId: the Alfresco group/site used for membership and permission checks
 *   - tenantClientId:  the Auth0 M2M client ID (= Tenant.code) that scopes all data queries
 *   - taxId:           the national tax identifier (e.g. Chilean RUT) used to filter pgrest
 *                      queries by cust_account. Only populated on child (sub-account) orgs;
 *                      parent orgs are site containers and keep taxId = null.
 */
@Entity
@Table(name = "organizations", schema = "miot_core")
public class Organization extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false, unique = true)
    public String slug;

    @Column(nullable = false)
    public String name;

    @Column(name = "display_name")
    public String displayName;

    @Column(name = "alfresco_group_id")
    public String alfrescoGroupId;

    @Column(name = "tenant_client_id", nullable = false)
    public String tenantClientId;

    /**
     * National tax identifier (e.g. Chilean RUT like "77856310-K").
     * Null on parent orgs. Format is validated by the pluggable TaxIdValidator on write;
     * this column only stores the normalized value.
     */
    @Column(name = "tax_id")
    public String taxId;

    /** Parent organization. Null means this org is a top-level (parent) org. Max 2 levels deep. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    public Organization parent;

    @Column(nullable = false)
    public boolean active = true;

    // --- Named finders (avoids static access via inherited PanacheEntityBase) ---

    public static Uni<Organization> findBySlug(String slug) {
        return find("slug = ?1 and active = true", slug).firstResult();
    }

    public static Uni<List<Organization>> findByParent(Long parentId) {
        return find("parent.id = ?1 and active = true", parentId).list();
    }

    public static Uni<List<Organization>> listAllActive() {
        return find("active = true").list();
    }
}
