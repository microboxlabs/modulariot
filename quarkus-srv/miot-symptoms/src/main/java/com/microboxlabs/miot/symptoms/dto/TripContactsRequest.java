package com.microboxlabs.miot.symptoms.dto;

import java.util.List;

/**
 * Body of {@code POST .../contacts/trip}: the case whose trip fills {@code event.data}, and the contact conditions
 * to evaluate (an operator step's {@code who} each).
 */
public record TripContactsRequest(String symptomId, List<String> conditions) {
}
