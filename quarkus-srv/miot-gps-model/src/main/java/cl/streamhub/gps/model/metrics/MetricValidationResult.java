package cl.streamhub.gps.model.metrics;

/**
 * Immutable result of metric validation.
 * Contains validation status, error code, and human-readable message.
 */
public final class MetricValidationResult {

    /** Error code for unknown/unregistered metric keys */
    public static final String UNKNOWN_KEY = "UNKNOWN_KEY";

    /** Error code for value type mismatch */
    public static final String TYPE_MISMATCH = "TYPE_MISMATCH";

    /** Error code for unit mismatch or missing unit */
    public static final String UNIT_MISMATCH = "UNIT_MISMATCH";

    /** Error code for numeric value out of bounds */
    public static final String OUT_OF_BOUNDS = "OUT_OF_BOUNDS";

    private static final MetricValidationResult OK_RESULT = new MetricValidationResult(true, null, null);

    private final boolean valid;
    private final String errorCode;
    private final String message;

    private MetricValidationResult(boolean valid, String errorCode, String message) {
        this.valid = valid;
        this.errorCode = errorCode;
        this.message = message;
    }

    /**
     * Returns true if the validation passed.
     */
    public boolean isValid() {
        return valid;
    }

    /**
     * Returns the error code if validation failed, null otherwise.
     * Possible values: UNKNOWN_KEY, TYPE_MISMATCH, UNIT_MISMATCH, OUT_OF_BOUNDS
     */
    public String getErrorCode() {
        return errorCode;
    }

    /**
     * Returns a human-readable error message if validation failed, null otherwise.
     */
    public String getMessage() {
        return message;
    }

    /**
     * Creates a successful validation result.
     */
    public static MetricValidationResult ok() {
        return OK_RESULT;
    }

    /**
     * Creates a failed validation result with the specified error code and message.
     *
     * @param errorCode the error code (e.g., UNKNOWN_KEY, TYPE_MISMATCH)
     * @param message human-readable error description
     */
    public static MetricValidationResult error(String errorCode, String message) {
        return new MetricValidationResult(false, errorCode, message);
    }
}
