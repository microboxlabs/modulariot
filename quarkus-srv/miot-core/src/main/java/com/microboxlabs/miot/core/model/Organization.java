package com.microboxlabs.miot.core.model;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * An organization is the multi-tenant unit for web users.
 * It maps a URL-friendly slug to:
 *   - alfrescoGroupId: the Alfresco group/site used for membership and permission checks
 *   - tenantClientId:  the Auth0 M2M client ID (= Tenant.code) that scopes all data queries
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

    @Column(name = "alfresco_group_id")
    public String alfrescoGroupId;

    @Column(name = "tenant_client_id", nullable = false)
    public String tenantClientId;

    public boolean active = true;
}
