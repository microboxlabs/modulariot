package com.microboxlabs.miot.tracking.api;

import cl.streamhub.gps.model.AssetTrackingData;
import cl.streamhub.gps.model.metrics.MetricItem;
import cl.streamhub.gps.model.metrics.MetricRegistry;
import cl.streamhub.gps.model.metrics.MetricValidationResult;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.tracking.errors.PublishPulsarError;
import com.microboxlabs.miot.tracking.service.AssetTrackingService;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.inject.Inject;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.eclipse.microprofile.openapi.annotations.enums.SecuritySchemeType;
import org.eclipse.microprofile.openapi.annotations.parameters.Parameter;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.security.SecurityScheme;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.jboss.logging.Logger;

@Path("/api/v1/asset/track")
@Tag(name = "Asset Tracking", description = "GPS position tracking for mobile assets")
@SecurityScheme(
        securitySchemeName = "oidc",
        type = SecuritySchemeType.HTTP,
        scheme = "bearer",
        bearerFormat = "JWT")
@IfBuildProperty(name = "miot.component.tracking.enabled", stringValue = "true")
public class AssetTrackingResource {

    private static final Logger logger = Logger.getLogger(AssetTrackingResource.class);

    @Inject
    AssetTrackingService trackingService;

    @Inject
    TenantContext tenantContext;

    @Inject
    Validator validator;

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @SecurityRequirement(name = "oidc")
    public Response track(
            @Parameter(description = "Asset tracking data", required = true)
                    AssetTrackingData assetTrackingData,
            @Parameter(description = "Unique request identifier for tracking", required = true)
                    @HeaderParam("X-Request-Id")
                    String requestId,
            @Parameter(description = "Request timestamp in Unix epoch seconds", required = true)
                    @HeaderParam("X-Request-Timestamp")
                    Double requestTimestamp) {

        String clientId = tenantContext.getClientId();

        try {
            logger.debugf(
                    "Request ID: %s, Request Timestamp: %s, Client ID: %s",
                    requestId, requestTimestamp, clientId);

            Optional<Response> validationError =
                    validateRequest(assetTrackingData, requestTimestamp, clientId, requestId);
            if (validationError.isPresent()) {
                return validationError.get();
            }

            var instant = Instant.ofEpochSecond(requestTimestamp.longValue());
            trackingService.trackAsset(assetTrackingData, requestId, instant);

            return Response.ok(Map.of("status", "success", "message", "Message sent successfully"))
                    .build();

        } catch (PublishPulsarError e) {
            logger.errorf(
                    e,
                    "Pulsar publishing failed for Client ID: %s, Request ID: %s",
                    clientId,
                    requestId);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(createErrorResponse("Failed to publish message", e.getMessage()))
                    .build();

        } catch (IllegalArgumentException e) {
            logger.warnf(
                    "Invalid request data for Client ID: %s, Request ID: %s, Error: %s",
                    clientId, requestId, e.getMessage());
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(createErrorResponse("Invalid request data", e.getMessage()))
                    .build();

        } catch (Exception e) {
            logger.errorf(
                    e,
                    "Unexpected error for Client ID: %s, Request ID: %s",
                    clientId,
                    requestId);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(createErrorResponse("Internal server error", "An unexpected error occurred"))
                    .build();
        }
    }

    private Optional<Response> validateRequest(
            AssetTrackingData data,
            Double requestTimestamp,
            String clientId,
            String requestId) {

        Set<ConstraintViolation<AssetTrackingData>> violations = validator.validate(data);
        if (!violations.isEmpty()) {
            logger.errorf(
                    "Validation failed for Client ID: %s, Request ID: %s, Violations: %s",
                    clientId, requestId, formatViolations(violations));

            Map<String, Object> response = new HashMap<>();
            response.put("status", "validation_error");
            response.put("message", "Request validation failed");
            response.put(
                    "errors",
                    violations.stream()
                            .collect(
                                    Collectors.toMap(
                                            v -> v.getPropertyPath().toString(),
                                            ConstraintViolation::getMessage,
                                            (a, b) -> a + "; " + b)));

            return Optional.of(
                    Response.status(Response.Status.BAD_REQUEST).entity(response).build());
        }

        if (data.getMetrics() != null && data.getMetrics().getItems() != null) {
            Map<String, String> metricErrors = buildMetricErrors(data.getMetrics().getItems());
            if (!metricErrors.isEmpty()) {
                logger.errorf(
                        "Metric validation failed for Client ID: %s, Request ID: %s, Errors: %s",
                        clientId, requestId, metricErrors);

                Map<String, Object> response = new HashMap<>();
                response.put("status", "validation_error");
                response.put("message", "Metric validation failed");
                response.put("errors", metricErrors);

                return Optional.of(
                        Response.status(Response.Status.BAD_REQUEST).entity(response).build());
            }
        }

        if (requestTimestamp == null) {
            return Optional.of(
                    Response.status(Response.Status.BAD_REQUEST)
                            .entity(
                                    createErrorResponse(
                                            "Missing required header",
                                            "X-Request-Timestamp is required"))
                            .build());
        }

        return Optional.empty();
    }

    private Map<String, String> buildMetricErrors(List<MetricItem> items) {
        Map<String, String> errors = new LinkedHashMap<>();
        for (int i = 0; i < items.size(); i++) {
            MetricItem item = items.get(i);
            MetricValidationResult result = MetricRegistry.validate(item);
            if (!result.isValid()) {
                errors.put(
                        "metrics.items[" + i + "]." + item.getK(),
                        "[" + result.getErrorCode() + "] " + result.getMessage());
            }
        }
        return errors;
    }

    private Map<String, Object> createErrorResponse(String message, String detail) {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "error");
        response.put("message", message);
        if (detail != null && !detail.trim().isEmpty()) {
            response.put("detail", detail);
        }
        return response;
    }

    private String formatViolations(Set<? extends ConstraintViolation<?>> violations) {
        return violations.stream()
                .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                .collect(Collectors.joining(", "));
    }
}
