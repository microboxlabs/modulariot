package com.microboxlabs.miot.integrations.calendar;

/**
 * Carries the HTTP status of a non-2xx miot-calendar response (and {@code -1}
 * for network/timeout errors) so {@link CalendarSyncExecutor} can branch:
 * 404/409 are benign SKIPs on a status push; everything else (including
 * {@code -1}) propagates so the worker reports FAILED and the ledger retries
 * with backoff.
 */
public class CalendarBookingsHttpException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final int status;

    public CalendarBookingsHttpException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int getStatus() {
        return status;
    }
}
