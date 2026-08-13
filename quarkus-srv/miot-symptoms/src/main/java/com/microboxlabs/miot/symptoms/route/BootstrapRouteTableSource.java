package com.microboxlabs.miot.symptoms.route;

import jakarta.enterprise.context.ApplicationScoped;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * JSON bootstrap for the routing table. Superadmin settings will replace this
 * {@link RouteTableSource} without changing {@link RouteTable} or the processor.
 */
@ApplicationScoped
public class BootstrapRouteTableSource implements RouteTableSource {

    private static final Logger LOG = Logger.getLogger(BootstrapRouteTableSource.class);

    private final Optional<String> routesJson;
    private final Optional<String> routesFile;

    BootstrapRouteTableSource(
            @ConfigProperty(name = "miot.symptoms.routes-json") Optional<String> routesJson,
            @ConfigProperty(name = "miot.symptoms.routes-file") Optional<String> routesFile) {
        this.routesJson = routesJson;
        this.routesFile = routesFile;
    }

    @Override
    public RouteTable load() {
        String json = readJson();
        RouteTable table = RouteTableParser.parse(json);
        LOG.infof("Loaded symptom RouteTable with %d route(s)", table.routes().size());
        return table;
    }

    private String readJson() {
        if (routesJson.filter(s -> !s.isBlank()).isPresent()) {
            return routesJson.orElseThrow();
        }
        if (routesFile.filter(s -> !s.isBlank()).isPresent()) {
            Path path = Path.of(routesFile.orElseThrow());
            try {
                return Files.readString(path, StandardCharsets.UTF_8);
            } catch (IOException e) {
                throw new IllegalStateException("Cannot read miot.symptoms.routes-file: " + path, e);
            }
        }
        return "{\"routes\":[]}";
    }
}
