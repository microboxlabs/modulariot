package com.microboxlabs.miot.integrations.service;

/**
 * The call could not be made, or could not be completed — an unknown operation, a
 * malformed or non-public URL, an unusable credential, a timeout, a dropped connection.
 *
 * <p>Distinct from a completed call that returned a non-2xx: that is an
 * {@link OperationInvocationResult}, because the partner's status and body are the useful
 * part and the caller decides what they mean.
 */
public class OperationInvocationException extends RuntimeException {

    public OperationInvocationException(String message) {
        super(message);
    }

    public OperationInvocationException(String message, Throwable cause) {
        super(message, cause);
    }
}
