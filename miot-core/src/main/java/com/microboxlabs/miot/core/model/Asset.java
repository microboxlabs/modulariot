package com.microboxlabs.miot.core.model;

import io.quarkus.hibernate.reactive.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "assets", schema = "miot_core")
public class Asset extends PanacheEntity {

    @ManyToOne
    public Tenant tenant;

    @Column(nullable = false)
    public String externalId;

    @Column(nullable = false)
    public String name;

    public String type;

    public boolean active = true;
}
