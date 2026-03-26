package com.microboxlabs.miot.resource.profile;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "rd_profile_items", schema = "miot_resource")
public class ProfileItem extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne
    public ResourceProfile profile;

    @Column(name = "resource_type", nullable = false)
    public String resourceType;

    @Column(name = "filter_criteria", columnDefinition = "jsonb")
    public String filterCriteria;

    @Column(name = "scoring_weights", columnDefinition = "jsonb")
    public String scoringWeights;

    @Column(name = "min_count")
    public Integer minCount;

    @Column(name = "max_count")
    public Integer maxCount;
}
