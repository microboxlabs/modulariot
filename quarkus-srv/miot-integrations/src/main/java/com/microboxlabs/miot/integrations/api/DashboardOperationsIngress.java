package com.microboxlabs.miot.integrations.api;

import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.vertx.http.runtime.RouteConstants;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;
import io.quarkus.vertx.http.runtime.VertxHttpRecorder;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/** Authenticate and bound this private endpoint before the global body handler or JSON reader. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class DashboardOperationsIngress {
    static final int MAX_BODY_BYTES = 524_288;
    private static final String PATH = "/internal/dashboard-operations";
    private final Optional<String> proxyKey;

    @Inject
    public DashboardOperationsIngress(@ConfigProperty(name = "miot.dashboards.proxy-key") Optional<String> proxyKey) {
        this.proxyKey = proxyKey;
    }

    void routes(@Observes Router router) {
        router.route().order(RouteConstants.ROUTE_ORDER_BODY_HANDLER - 1).handler(this::guard);
        router.route().order(RouteConstants.ROUTE_ORDER_BEFORE_DEFAULT).handler(context -> {
            if (matches(context)) context.put(VertxHttpRecorder.MAX_REQUEST_SIZE_KEY, (long) MAX_BODY_BYTES);
            context.next();
        });
    }

    private void guard(RoutingContext context) {
        if (!matches(context)) {
            context.next();
            return;
        }
        context.addHeadersEndHandler(ignored -> context.response().putHeader("Cache-Control", "no-store"));
        String configured = proxyKey.orElse("");
        if (configured.isBlank() || configured.length() < 32) {
            reject(context, 503, "Dashboard operations are not configured");
        } else if (!DashboardCredentialsResource.keyAccepted(configured, context.request().getHeader("x-miot-proxy-key"))) {
            reject(context, 401, "Unauthorized");
        } else {
            String length = context.request().getHeader("Content-Length");
            if (length != null && Long.parseLong(length) > MAX_BODY_BYTES) reject(context, 413, "Request body is too large");
            else context.next();
        }
    }

    private static boolean matches(RoutingContext context) {
        String path = context.normalizedPath();
        return PATH.equals(path) || (PATH + "/").equals(path)
                || (PATH + "/resolve").equals(path) || (PATH + "/resolve/").equals(path);
    }

    private static void reject(RoutingContext context, int status, String message) {
        context.response().setStatusCode(status).putHeader("Content-Type", "application/json")
                .end("{\"error\":\"" + message + "\"}");
    }
}
