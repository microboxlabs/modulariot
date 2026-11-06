package com.microboxlabs.miot.symptoms.dto;

import java.util.List;
import java.util.Map;

/**
 * The contact book's people for a case, one list per contact condition (an operator step's {@code who}).
 *
 * @param data     {@code event.data} the conditions were read with: the trip's {@code driverRut},
 *                 {@code secondDriverRut} and {@code carrierRut}, normalized, and its {@code origin},
 *                 {@code destination}, their keys and geofence ids; empty without a live trip
 * @param matches  for each condition, in order, the ids of the active contacts that meet it
 * @param problems for each condition, its compile problem, or null
 */
public record TripContactsView(Map<String, Object> data, List<List<String>> matches, List<String> problems) {
}
