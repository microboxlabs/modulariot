package com.microboxlabs.miot.cli;

import com.microboxlabs.miot.core.config.ComponentRegistry;
import io.quarkus.runtime.ShutdownEvent;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

@ApplicationScoped
public class ComponentLifecycle {

    private static final Logger LOG = Logger.getLogger(ComponentLifecycle.class);

    @Inject
    ComponentRegistry registry;

    void onStart(@Observes StartupEvent ev) {
        registry.startAll();
        var active = registry.active();
        if (active.isEmpty()) {
            LOG.info("No active ModularIoT components");
        } else {
            LOG.infof("Started %d ModularIoT component(s):", active.size());
            active.forEach(c -> LOG.infof("  > %s (priority %d)", c.name(), c.priority()));
        }
    }

    void onStop(@Observes ShutdownEvent ev) {
        registry.stopAll();
    }
}
