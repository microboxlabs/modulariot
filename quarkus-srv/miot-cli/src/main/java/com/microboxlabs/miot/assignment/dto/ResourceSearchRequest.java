package com.microboxlabs.miot.assignment.dto;

public record ResourceSearchRequest(
        Long carrierId,
        String delegacion,
        String rutMandante,
        String bookingId,
        String slotDate,
        Integer slotHour,
        Integer slotMinutes
) {}
