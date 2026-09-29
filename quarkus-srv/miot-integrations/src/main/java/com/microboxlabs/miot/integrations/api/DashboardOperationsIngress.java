package com.microboxlabs.miot.integrations.api;

import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.vertx.http.runtime.RouteConstants;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;
import io.vertx.ext.web.handler.BodyHandler;
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
    private final BodyHandler body = BodyHandler.create().setBodyLimit(MAX_BODY_BYTES)
            .setHandleFileUploads(false).setMergeFormAttributes(false);

    @Inject
    public DashboardOperationsIngress(@ConfigProperty(name = "miot.dashboards.proxy-key") Optional<String> proxyKey) {
        this.proxyKey = proxyKey;
    }

    void routes(@Observes Router router) {
        router.route().order(RouteConstants.ROUTE_ORDER_BODY_HANDLER - 1).handler(this::guard);
    }

    private void guard(RoutingContext context) {
        String path = context.normalizedPath();
        if (!PATH.equals(path) && !(PATH + "/").equals(path)) {
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
            body.handle(context);
        }
    }

    private static void reject(RoutingContext context, int status, String message) {
        context.response().setStatusCode(status).putHeader("Content-Type", "application/json")
                .end("{\"error\":\"" + message + "\"}");
    }
}
