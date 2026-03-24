package com.microboxlabs.miot.cli;

import com.microboxlabs.miot.core.config.ComponentRegistry;
import io.quarkus.runtime.Quarkus;
import jakarta.inject.Inject;
import picocli.CommandLine;

@CommandLine.Command(
        name = "fleet",
        description = "Boot only the fleet component"
)
public class FleetCommand implements Runnable {

    @Inject
    ComponentRegistry registry;

    @CommandLine.Option(names = "--port", description = "HTTP port", defaultValue = "8080")
    int port;

    @Override
    public void run() {
        System.setProperty("quarkus.http.port", String.valueOf(port));
        System.setProperty("miot.component.fleet.enabled", "true");
        System.out.println("Starting fleet component on port " + port + "...");
        registry.startAll();
        Quarkus.waitForExit();
    }
}
