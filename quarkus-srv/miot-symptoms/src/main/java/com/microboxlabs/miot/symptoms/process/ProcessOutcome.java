package com.microboxlabs.miot.symptoms.process;

/**
 * Result of handling one Debezium message. Skips are successful acks
 * (same as the old service). Failures nack.
 */
public record ProcessOutcome(Kind kind, String symptom, String reason) {

    public enum Kind {
        SKIPPED,
        PROCESSED
    }

    public static ProcessOutcome skipped(String reason) {
        return new ProcessOutcome(Kind.SKIPPED, null, reason);
    }

    public static ProcessOutcome processed(String symptom) {
        return new ProcessOutcome(Kind.PROCESSED, symptom, null);
    }
}
