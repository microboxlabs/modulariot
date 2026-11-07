package com.microboxlabs.miot.core.config;

import io.quarkus.vertx.http.runtime.RouteConstants;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * With {@code miot.api.enabled=false} (a worker pod, such as the symptom engine) every path outside {@code /q/}
 * answers 404 before authentication or the body is read: the image holds every component's endpoints, and a worker
 * serves only health and metrics.
 */
@ApplicationScoped
public class ApiSurface {

    static final String MANAGEMENT = "/q";

    private final boolean enabled;

    @Inject
    public ApiSurface(@ConfigProperty(name = "miot.api.enabled", defaultValue = "true") boolean enabled) {
        this.enabled = enabled;
    }

    void routes(@Observes Router router) {
        if (!enabled) {
            router.route().order(RouteConstants.ROUTE_ORDER_BODY_HANDLER - 1).handler(this::guard);
        }
    }

    private void guard(RoutingContext context) {
        if (served(context.normalizedPath())) {
            context.next();
        } else {
            context.response().setStatusCode(404).end();
        }
    }

    /** Whether a worker pod answers this path: health, metrics and the rest of {@code /q/}. */
    static boolean served(String path) {
        return path != null && (path.equals(MANAGEMENT) || path.startsWith(MANAGEMENT + "/"));
    }
}
