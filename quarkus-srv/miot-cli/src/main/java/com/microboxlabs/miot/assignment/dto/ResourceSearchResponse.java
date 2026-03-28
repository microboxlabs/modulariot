package com.microboxlabs.miot.assignment.dto;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record ResourceSearchResponse(
                List<DriverCandidate> drivers,
                List<TruckCandidate> trucks,
                List<TrailerCandidate> trailers) {

        public record DriverCandidate(
                        Long id,
                        UUID entityId,
                        String externalId,
                        String fullName,
                        String rut,
                        String status,
                        boolean active,
                        boolean certified,
                        boolean available,
                        Map<String, Object> calculatedFields) {
        }

        public record TruckCandidate(
                        Long id,
                        UUID entityId,
                        String externalId,
                        String licensePlate,
                        String brand,
                        String model,
                        String truckType,
                        String status,
                        boolean active,
                        boolean certified,
                        boolean available,
                        Map<String, Object> calculatedFields) {
        }

        public record TrailerCandidate(
                        Long id,
                        UUID entityId,
                        String externalId,
                        String licensePlate,
                        String trailerType,
                        String status,
                        boolean active,
                        boolean certified,
                        boolean available,
                        Map<String, Object> calculatedFields) {
        }
}
