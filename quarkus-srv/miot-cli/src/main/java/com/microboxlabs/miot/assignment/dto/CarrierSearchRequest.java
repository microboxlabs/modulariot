package com.microboxlabs.miot.assignment.dto;

public record CarrierSearchRequest(
        String delegacion,
        String rutMandante,
        String bookingId,
        String slotDate,
        Integer slotHour,
        Integer slotMinutes
) {}
