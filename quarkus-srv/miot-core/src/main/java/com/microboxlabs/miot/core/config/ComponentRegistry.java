package com.microboxlabs.miot.core.config;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.Comparator;
import java.util.List;

/**
 * Discovers and manages all active {@link IMiotComponent} instances.
 */
@ApplicationScoped
public class ComponentRegistry {

    @Inject
    Instance<IMiotComponent> components;

    public List<IMiotComponent> active() {
        return components.stream()
                .sorted(Comparator.comparingInt(IMiotComponent::priority))
                .toList();
    }

    public void startAll() {
        active().forEach(IMiotComponent::onStart);
    }

    public void stopAll() {
        var reversed = active().reversed();
        reversed.forEach(IMiotComponent::onStop);
    }
}
