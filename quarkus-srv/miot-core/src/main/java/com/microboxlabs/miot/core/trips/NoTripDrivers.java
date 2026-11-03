package com.microboxlabs.miot.core.trips;

import io.quarkus.arc.DefaultBean;
import jakarta.enterprise.context.ApplicationScoped;

/** Used when the trips module is not in the build: no driver is ever assigned. */
@ApplicationScoped
@DefaultBean
public class NoTripDrivers implements TripDrivers {
}
