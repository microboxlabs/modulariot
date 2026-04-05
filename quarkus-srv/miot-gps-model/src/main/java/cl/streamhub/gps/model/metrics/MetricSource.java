package cl.streamhub.gps.model.metrics;

/**
 * Constants for valid metric source identifiers.
 * Use these constants when setting the 'src' field on MetricItem.
 */
public final class MetricSource {

    /** OBD-II protocol source */
    public static final String OBD2 = "obd2";

    /** SAE J1939 heavy-duty vehicle protocol */
    public static final String J1939 = "j1939";

    /** Raw CAN bus data */
    public static final String CAN = "can";

    /** OEM-specific proprietary data */
    public static final String OEM = "oem";

    /** Computed/derived metric */
    public static final String DERIVED = "derived";

    /** Unknown or unspecified source */
    public static final String UNKNOWN = "unknown";

    private MetricSource() {
        // Prevent instantiation
    }
}
