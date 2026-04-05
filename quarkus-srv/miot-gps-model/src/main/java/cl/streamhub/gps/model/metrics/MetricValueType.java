package cl.streamhub.gps.model.metrics;

/**
 * Constants for valid metric value types.
 * Used by MetricDefinition to specify expected value types.
 */
public final class MetricValueType {

    /** Numeric value (integer or floating point) */
    public static final String NUMBER = "number";

    /** Boolean value (true/false) */
    public static final String BOOLEAN = "boolean";

    /** String value */
    public static final String STRING = "string";

    /** Array value */
    public static final String ARRAY = "array";

    /** Object/map value */
    public static final String OBJECT = "object";

    private MetricValueType() {
        // Prevent instantiation
    }
}
