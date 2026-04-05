package cl.streamhub.gps.model.metrics;

/**
 * Constants for valid metric quality indicators.
 * Use these constants when setting the 'q' field on MetricItem.
 */
public final class MetricQuality {

    /** Value is valid and reliable */
    public static final String OK = "ok";

    /** Value is estimated or interpolated */
    public static final String ESTIMATED = "estimated";

    /** Value is outdated or from a previous reading */
    public static final String STALE = "stale";

    /** Value failed validation or is out of bounds */
    public static final String INVALID = "invalid";

    /** Value could not be read from the source */
    public static final String MISSING = "missing";

    private MetricQuality() {
        // Prevent instantiation
    }
}
