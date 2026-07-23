package com.microboxlabs.miot.integrations.service;

/**
 * A completed call to a provider operation: whatever it answered, verdict included.
 *
 * <p>A non-2xx is a <i>result</i>, not an exception — the status and body are the useful
 * part (a validation list, a business rejection, a rate-limit notice) and only the caller
 * knows whether they mean "give up" or "try later".
 */
public record OperationInvocationResult(int status, String body) {

    public boolean successful() {
        return status >= 200 && status < 300;
    }

    /**
     * Whether trying the same request again could plausibly succeed.
     *
     * <p>5xx is the server's own admission that this was its fault. {@code 408} and
     * {@code 429} are 4xx by number but explicitly mean "later, not never" — treating them
     * as permanent would park a job over a transient rate limit. Every other 4xx is the
     * request's fault and will fail identically on retry.
     */
    public boolean retryable() {
        return status >= 500 || status == 408 || status == 429;
    }

    /** A short, log-safe description. The body is capped — it can be a whole HTML page. */
    public String summary() {
        String text = body == null ? "" : body.strip();
        if (text.isEmpty()) {
            return "HTTP " + status;
        }
        String trimmed = text.length() <= 300 ? text : text.substring(0, 300) + "…";
        return "HTTP " + status + ": " + trimmed;
    }
}
