package com.microboxlabs.miot.trips.dto;

/** Reception of a delivered cargo: {@code result} conforming | discrepancy; notes required on discrepancy. */
public record ReceiveRequest(String result, String notes) {
}
