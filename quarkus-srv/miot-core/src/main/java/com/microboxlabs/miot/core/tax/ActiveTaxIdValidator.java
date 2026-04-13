package com.microboxlabs.miot.core.tax;

import jakarta.inject.Qualifier;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * CDI qualifier for the {@link TaxIdValidator} selected by the
 * {@code miot.tax-id.validator} config key. Inject with
 * {@code @ActiveTaxIdValidator TaxIdValidator validator}. The producer
 * lives in {@link TaxIdValidatorProducer}.
 */
@Qualifier
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.METHOD})
public @interface ActiveTaxIdValidator {
}
