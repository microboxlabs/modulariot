package com.microboxlabs.miot.trips.dto;

/** Reception of a delivered cargo: {@code result} conforme | diferencia; notes required on diferencia. */
public record ReceiveRequest(String result, String notes) {
}
