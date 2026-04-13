package com.microboxlabs.miot.core.tax;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Produces the active {@link TaxIdValidator} based on
 * {@code miot.tax-id.validator} (env: {@code MIOT_TAX_ID_VALIDATOR}).
 * Defaults to {@code chilean_rut} since Chile is the only validator
 * that ships today; new validators can register themselves by
 * implementing {@link TaxIdValidator} and matching the config code.
 *
 * <p>If no validator matches the configured code, the producer throws
 * at startup — failing fast is better than silently accepting every
 * string as valid.
 */
@ApplicationScoped
public class TaxIdValidatorProducer {

    private static final Logger LOG = Logger.getLogger(TaxIdValidatorProducer.class);

    private final String configuredCode;
    private final Instance<TaxIdValidator> validators;

    @Inject
    public TaxIdValidatorProducer(
            @ConfigProperty(name = "miot.tax-id.validator", defaultValue = "chilean_rut") String configuredCode,
            Instance<TaxIdValidator> validators) {
        this.configuredCode = configuredCode;
        this.validators = validators;
    }

    @Produces
    @ApplicationScoped
    @ActiveTaxIdValidator
    public TaxIdValidator activeValidator() {
        for (TaxIdValidator candidate : validators) {
            if (configuredCode.equalsIgnoreCase(candidate.code())) {
                LOG.infof("Active tax id validator: %s", candidate.code());
                return candidate;
            }
        }
        throw new IllegalStateException(
                "No TaxIdValidator registered for code '" + configuredCode
                        + "'. Check miot.tax-id.validator / MIOT_TAX_ID_VALIDATOR.");
    }
}
