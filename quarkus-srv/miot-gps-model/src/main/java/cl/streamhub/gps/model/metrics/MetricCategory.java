package cl.streamhub.gps.model.metrics;

/**
 * Constants for metric categories.
 * Used to group related metrics by their functional domain.
 */
public final class MetricCategory {

    /** Engine and powertrain metrics (rpm, speed, load, throttle, temperatures, runtime) */
    public static final String POWERTRAIN = "powertrain";

    /** Fuel system metrics (level, rate, consumption, voltage, torque) */
    public static final String FUEL = "fuel";

    /** Vehicle motion metrics (odometer, idle state, accelerator, brake) */
    public static final String MOTION = "motion";

    /** Diagnostic trouble code metrics (MIL, DTCs, freeze frames) */
    public static final String DIAGNOSTICS = "diagnostics";

    /** Emissions-related metrics (fuel trim, lambda, catalyst) */
    public static final String EMISSIONS = "emissions";

    /** Electrical system metrics (battery current, PTO, fan) */
    public static final String ELECTRICAL = "electrical";

    /** Vehicle identity metrics (VIN, protocol, ECU) */
    public static final String IDENTITY = "identity";

    private MetricCategory() {
        // Prevent instantiation
    }
}
