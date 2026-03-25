package com.microboxlabs.miot.driver.model;

import com.microboxlabs.miot.core.model.Tenant;
import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "rd_drivers", schema = "miot_driver")
public class Driver extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne
    public Tenant tenant;

    @Column(name = "client_id", nullable = false)
    public String clientId;

    @Column(name = "entity_id", nullable = false)
    public UUID entityId;

    @Column(name = "external_id", nullable = false)
    public String externalId;

    @Column(name = "first_name", nullable = false)
    public String firstName;

    @Column(name = "last_name", nullable = false)
    public String lastName;

    public String rut;

    public String phone;

    @Column(name = "mobile_phone")
    public String mobilePhone;

    public String email;

    @Column(name = "license_number")
    public String licenseNumber;

    @Column(name = "license_category")
    public String licenseCategory;

    @Column(name = "license_expires")
    public Instant licenseExpires;

    @Column(name = "carrier_id")
    public Long carrierId;

    @Column(name = "is_occasional")
    public boolean isOccasional = false;

    @Column(name = "operation_blocked")
    public boolean operationBlocked = false;

    public String status = "ACTIVE";

    @Column(name = "alfresco_node_id")
    public String alfrescoNodeId;

    public boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt;

    @PrePersist
    void prePersist() {
        if (entityId == null) entityId = UUID.randomUUID();
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }
}
