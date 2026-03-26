package com.microboxlabs.miot.fleet.model;

import com.microboxlabs.miot.resource.model.BaseResourceEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "rd_trailers", schema = "miot_fleet")
public class Trailer extends BaseResourceEntity {

    @Column(name = "license_plate", nullable = false)
    public String licensePlate;

    @Column(name = "trailer_type")
    public String trailerType;

    @Column(name = "max_weight")
    public BigDecimal maxWeight;

    @Column(name = "axle_count")
    public Integer axleCount;
}
