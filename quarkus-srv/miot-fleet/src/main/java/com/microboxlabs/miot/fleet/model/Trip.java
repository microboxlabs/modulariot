package com.microboxlabs.miot.fleet.model;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "trips", schema = "miot_fleet")
public class Trip extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne
    public Vehicle vehicle;

    @Column(nullable = false)
    public Instant startTime;

    public Instant endTime;

    public Double startLat;
    public Double startLon;
    public Double endLat;
    public Double endLon;

    public Double distanceKm;
}
