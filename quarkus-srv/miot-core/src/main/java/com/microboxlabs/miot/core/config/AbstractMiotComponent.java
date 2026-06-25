package com.microboxlabs.miot.core.config;

import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.jboss.logging.Logger;

/**
 * Base {@link IMiotComponent} that supplies the standard lifecycle boilerplate
 * (start/stop logging + an UP health check named after the component). Concrete
 * components only declare {@link #name()}, {@link #priority()} and a
 * {@link #log() logger}. Existing components may migrate to this over time.
 */
public abstract class AbstractMiotComponent implements IMiotComponent {

    /** Component-specific logger used for the lifecycle log lines. */
    protected abstract Logger log();

    @Override
    public void onStart() {
        log().infof("%s component started", name());
    }

    @Override
    public void onStop() {
        log().infof("%s component stopped", name());
    }

    @Override
    public HealthCheck healthCheck() {
        return () -> HealthCheckResponse.named(name()).up().build();
    }
}
