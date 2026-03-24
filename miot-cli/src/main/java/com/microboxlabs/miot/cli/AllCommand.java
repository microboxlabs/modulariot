package com.microboxlabs.miot.cli;

import com.microboxlabs.miot.core.config.ComponentRegistry;
import io.quarkus.runtime.Quarkus;
import jakarta.inject.Inject;
import picocli.CommandLine;

@CommandLine.Command(
        name = "all",
        description = "Boot all enabled components"
)
public class AllCommand implements Runnable {

    @Inject
    ComponentRegistry registry;

    @Override
    public void run() {
        System.out.println("Starting all ModularIoT components...");
        registry.startAll();
        registry.active().forEach(c ->
                System.out.printf("  ✓ %s (priority %d)%n", c.name(), c.priority()));
        Quarkus.waitForExit();
    }
}
