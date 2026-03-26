package com.microboxlabs.miot.fleet.model;

import com.microboxlabs.miot.resource.model.BaseResourceEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "rd_carriers", schema = "miot_fleet")
public class Carrier extends BaseResourceEntity {

    @Column(nullable = false)
    public String name;

    public String rut;

    @Column(name = "transport_license")
    public String transportLicense;

    @Column(name = "transport_license_expires")
    public Instant transportLicenseExpires;
}
