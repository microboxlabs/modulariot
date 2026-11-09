package com.microboxlabs.miot.core.config;

import io.quarkus.vertx.http.runtime.RouteConstants;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;
import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import java.util.List;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * With {@code miot.api.enabled=false} (a worker pod, such as the symptom engine) every path outside {@code /q/}
 * answers 404 before authentication or the body is read: the image holds every component's endpoints, and a worker
 * serves only health and metrics.
 */
@ApplicationScoped
public class ApiSurface {

    private final boolean enabled;
    private final List<String> managementPaths;

    @Inject
    public ApiSurface(@ConfigProperty(name = "miot.api.enabled", defaultValue = "true") boolean enabled,
            @ConfigProperty(name = "quarkus.http.root-path", defaultValue = "/") String root,
            @ConfigProperty(name = "quarkus.http.non-application-root-path", defaultValue = "q") String management,
            @ConfigProperty(name = "quarkus.smallrye-health.root-path", defaultValue = "health") String health,
            @ConfigProperty(name = "quarkus.micrometer.export.prometheus.path", defaultValue = "metrics") String metrics) {
        this.enabled = enabled;
        String nonApplicationRoot = managementPath(root, management);
        this.managementPaths = List.of(nonApplicationRoot,
                managementPath(nonApplicationRoot, health), managementPath(nonApplicationRoot, metrics));
    }

    void routes(@Observes @Priority(1) Router router) {
        if (!enabled) {
            router.route().order(RouteConstants.ROUTE_ORDER_BODY_HANDLER - 1).handler(this::guard);
        }
    }

    private void guard(RoutingContext context) {
        if (managementPaths.stream().anyMatch(path -> served(context.normalizedPath(), path))) {
            context.next();
        } else {
            context.response().setStatusCode(404).end();
        }
    }

    /** Whether a worker pod answers this path: health, metrics and the rest of {@code /q/}. */
    static boolean served(String path, String management) {
        return path != null && (path.equals(management) || path.startsWith(management + "/"));
    }

    @SuppressWarnings("java:S1075") // HTTP path delimiters are protocol syntax, independent of the filesystem.
    static String managementPath(String root, String management) {
        String path = management;
        if (!management.startsWith("/")) {
            String prefix = root.endsWith("/") ? root : root + "/";
            path = prefix + management;
        }
        return path.endsWith("/") ? path.substring(0, path.length() - 1) : path;
    }
}
