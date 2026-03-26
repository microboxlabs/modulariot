package com.microboxlabs.miot.driver.model;

import com.microboxlabs.miot.resource.model.BaseResourceEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "rd_drivers", schema = "miot_driver")
public class Driver extends BaseResourceEntity {

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
}
