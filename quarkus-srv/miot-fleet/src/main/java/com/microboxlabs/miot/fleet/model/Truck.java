package com.microboxlabs.miot.fleet.model;

import com.microboxlabs.miot.resource.model.BaseResourceEntity;
import io.vertx.core.json.JsonObject;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.math.BigDecimal;

@Entity
@Table(name = "rd_trucks", schema = "miot_fleet")
public class Truck extends BaseResourceEntity {

    @Column(name = "license_plate", nullable = false)
    public String licensePlate;

    public String vin;

    public String brand;

    public String model;

    public Integer year;

    @Column(name = "max_weight")
    public BigDecimal maxWeight;

    public BigDecimal volume;

    @Column(name = "truck_type")
    public String truckType;

    // GPS/metrics system identifier — maps to asset_metric_core.asset_id
    @Column(name = "asset_id")
    public String assetId;

    @Transient
    public JsonObject latestMetrics;
}
