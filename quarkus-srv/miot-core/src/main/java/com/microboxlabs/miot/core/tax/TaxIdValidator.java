package com.microboxlabs.miot.core.tax;

/**
 * Validates and normalizes a national tax identifier. One implementation
 * ships per jurisdiction; the active one is selected by the
 * {@code miot.tax-id.validator} config key (exposed as
 * {@code MIOT_TAX_ID_VALIDATOR}).
 *
 * <p>Normalization is idempotent: a normalized value passed back in must
 * compare equal to its own normalization. Tests rely on this.
 */
public interface TaxIdValidator {

    /**
     * Short code identifying this validator in config
     * (e.g. {@code "chilean_rut"}). Used by the CDI producer to resolve
     * the bean at startup.
     */
    String code();

    /**
     * Parse, validate and normalize a raw tax id string. Returns the
     * canonical form on success (e.g. {@code "77.856.310-K"} → {@code "77856310-K"}).
     *
     * @throws InvalidTaxIdException if the input is syntactically or
     *         semantically invalid
     */
    String normalize(String raw);

    /**
     * Convenience: {@link #normalize(String)} without throwing. Returns
     * the normalized value on success, {@code null} on failure. Use this
     * when you need a boolean-style check.
     */
    default String tryNormalize(String raw) {
        try {
            return normalize(raw);
        } catch (InvalidTaxIdException e) {
            return null;
        }
    }

    /** Thrown by {@link #normalize(String)} when the input is invalid. */
    class InvalidTaxIdException extends RuntimeException {
        public InvalidTaxIdException(String message) {
            super(message);
        }
    }
}
