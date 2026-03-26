package com.microboxlabs.miot.core.config;

import org.eclipse.microprofile.health.HealthCheck;

/**
 * Standard lifecycle interface for every ModularIoT component.
 */
public interface IMiotComponent {

    String name();

    int priority();

    void onStart();

    void onStop();

    HealthCheck healthCheck();
}
