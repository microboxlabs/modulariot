package com.microboxlabs.miot.fleet.model;

import com.microboxlabs.miot.core.model.Tenant;
import io.quarkus.hibernate.reactive.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "vehicles", schema = "miot_fleet")
public class Vehicle extends PanacheEntity {

    @ManyToOne
    public Tenant tenant;

    @Column(nullable = false)
    public String plate;

    public String vin;

    public String brand;

    public String model;

    public int year;

    public boolean active = true;
}
