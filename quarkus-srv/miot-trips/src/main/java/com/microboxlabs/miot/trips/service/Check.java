package com.microboxlabs.miot.trips.service;

/** Manual request validation shared by the trips services; failures become 400s. */
final class Check {

    private Check() {
    }

    static String required(String value, String field, int max) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
        return limited(value.trim(), field, max);
    }

    static String limited(String value, String field, int max) {
        if (value.length() > max) {
            throw new IllegalArgumentException(field + " must be at most " + max + " characters");
        }
        return value;
    }

    static String limitedOrNull(String value, String field, int max) {
        return value == null || value.isBlank() ? null : limited(value.trim(), field, max);
    }

    static String orKeep(String incoming, String current, String field, int max) {
        if (incoming == null) {
            return current;
        }
        return incoming.isBlank() ? null : limited(incoming.trim(), field, max);
    }

    static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    /** Blank clears; anything else must be a UUID, or the store would save it as NULL. */
    static String uuidOrNull(String value, String field) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return TripService.parse(value.trim(), field).toString();
    }

    static String oneOf(String value, String field, String... allowed) {
        for (String a : allowed) {
            if (a.equals(value)) {
                return value;
            }
        }
        throw new IllegalArgumentException(field + " must be one of " + String.join(", ", allowed));
    }
}
