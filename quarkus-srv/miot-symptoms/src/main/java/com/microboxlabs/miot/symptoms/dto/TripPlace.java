package com.microboxlabs.miot.symptoms.dto;

/**
 * A place the organization's trips start or end at, written as the trips name it. Offered as a contact tag so a
 * step can find a contact by the trip's origin or destination.
 *
 * @param label the place's name, as most trips write it
 * @param origins how many live trips start there
 * @param destinations how many live trips end there
 */
public record TripPlace(String label, long origins, long destinations) {
}
