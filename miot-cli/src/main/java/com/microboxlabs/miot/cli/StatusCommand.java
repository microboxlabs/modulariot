package com.microboxlabs.miot.cli;

import com.microboxlabs.miot.core.config.ComponentRegistry;
import jakarta.inject.Inject;
import picocli.CommandLine;

@CommandLine.Command(
        name = "status",
        description = "Show health status of all active components"
)
public class StatusCommand implements Runnable {

    @Inject
    ComponentRegistry registry;

    @Override
    public void run() {
        var components = registry.active();
        if (components.isEmpty()) {
            System.out.println("No active components");
            return;
        }
        System.out.println("Active components:");
        components.forEach(c -> {
            var health = c.healthCheck().call();
            System.out.printf("  %s: %s%n", c.name(), health.getStatus());
        });
    }
}
