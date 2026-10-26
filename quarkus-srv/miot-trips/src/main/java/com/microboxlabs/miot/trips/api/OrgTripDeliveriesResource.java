package com.microboxlabs.miot.trips.api;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.content.ContentService;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.trips.access.TripsAccessCatalog;
import com.microboxlabs.miot.trips.service.DeliveryService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.StreamingOutput;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

/** Deliveries of a trip's loads: which mandates each covers, its proofs (POD) and its steps. */
@Path("/api/v1/orgs/{organizationId}/trips/{id}/deliveries")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Trips — Deliveries", description = "Deliveries of a trip's loads, their proofs and steps")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class OrgTripDeliveriesResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";
    private static final String ID = "id";
    private static final String DELIVERY = "deliveryId";
    private static final String STEP = "step";
    private static final ObjectMapper JSON = new ObjectMapper();

    /** {@code mandates} are ids or codes of the trip's mandates; empty takes every one no delivery covers. */
    public record CreateRequest(String reference, String customer, List<String> mandates,
            Map<String, Object> evidence, String note, String source) {
    }

    /** A proof kept elsewhere ({@code url}) or a file already uploaded ({@code contentId}). */
    public record ProofRequest(String kind, String url, String contentId, String name, Map<String, Object> metadata,
            String source) {
    }

    /** {@code at} defaults to the time a pending request proposed, else now. {@code channel} is ui or api. */
    public record ConfirmRequest(OffsetDateTime at, String channel, String note, Map<String, Object> evidence) {
    }

    public record RejectRequest(String channel, String note) {
    }

    private final DeliveryService deliveries;

    @Inject
    public OrgTripDeliveriesResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            DeliveryService deliveries) {
        super(tenantContext, organizationContext, roleService, identity);
        this.deliveries = deliveries;
    }

    @GET
    @Operation(operationId = "listTripDeliveries",
            summary = "The trip's delivery cycle, its deliveries and the loads no delivery covers yet")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> list(@PathParam(ORG) String organizationId, @PathParam(ID) String id) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(deliveries.list(tenant, uuid(id, ID))).build());
    }

    @POST
    @Operation(operationId = "createTripDelivery",
            summary = "Creates a delivery for loads of the trip; one with a known reference is returned as is")
    @PermissionsAllowed(value = TripsAccessCatalog.DELIVERY_OPERATE, permission = OrgPermission.class,
            params = ORG)
    public Uni<Response> create(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            CreateRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(deliveries.create(tenant, actor, uuid(id, ID), body == null ? null
                : new DeliveryService.NewDelivery(body.reference(), body.customer(), body.mandates(),
                        body.evidence(), body.note(), body.source()))).build());
    }

    @POST
    @Path("/{deliveryId}/proofs")
    @Operation(operationId = "linkTripDeliveryProof",
            summary = "Adds a proof kept elsewhere (url) or already uploaded (contentId)")
    @PermissionsAllowed(value = TripsAccessCatalog.DELIVERY_OPERATE, permission = OrgPermission.class,
            params = ORG)
    public Uni<Response> link(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            @PathParam(DELIVERY) String deliveryId, ProofRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(deliveries.addProof(tenant, actor, uuid(id, ID), uuid(deliveryId, DELIVERY),
                body == null ? null : new DeliveryService.NewProof(body.kind(), body.contentId(), body.url(),
                        body.name(), body.metadata(), body.source()))).build());
    }

    @POST
    @Path("/{deliveryId}/proofs")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Operation(operationId = "uploadTripDeliveryProof",
            summary = "Uploads a proof file (image or PDF); kind is signature, photo, document or other")
    @PermissionsAllowed(value = TripsAccessCatalog.DELIVERY_OPERATE, permission = OrgPermission.class,
            params = ORG)
    @SuppressWarnings("java:S107") // One form field per parameter.
    public Uni<Response> upload(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            @PathParam(DELIVERY) String deliveryId, @RestForm("file") FileUpload file, @RestForm String kind,
            @RestForm String metadata, @RestForm String source) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> {
            if (file == null) {
                throw new IllegalArgumentException("file is required");
            }
            Map<String, Object> meta = metadata(metadata);
            try (InputStream in = Files.newInputStream(file.uploadedFile())) {
                return Response.ok(deliveries.upload(tenant, actor, uuid(id, ID), uuid(deliveryId, DELIVERY), kind,
                        file.fileName(), file.contentType(), in, meta, source)).build();
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        });
    }

    @GET
    @Path("/proofs/{proofId}/content")
    @Produces(MediaType.WILDCARD)
    @Operation(operationId = "getTripDeliveryProofContent", summary = "The file of a proof")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> content(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            @PathParam("proofId") String proofId) {
        String tenant = tenantCode(organizationId);
        return work(() -> {
            ContentService.Opened opened = deliveries.proofContent(tenant, uuid(id, ID), uuid(proofId, "proofId"));
            StreamingOutput body = out -> {
                try (InputStream in = opened.stream()) {
                    in.transferTo(out);
                }
            };
            String name = opened.content().name() == null ? "proof" : opened.content().name();
            return Response.ok(body, opened.content().mimetype())
                    .header("Content-Disposition", "inline; filename=\"" + name.replaceAll("[\"\\\\]", "_") + "\"")
                    .header("Content-Length", opened.content().size())
                    .header("X-Content-Type-Options", "nosniff")
                    .header("Content-Security-Policy", "sandbox; default-src 'none'; img-src 'self' data:")
                    .header("Cache-Control", "private, max-age=300")
                    .build();
        });
    }

    @POST
    @Path("/{deliveryId}/steps/{step}/confirm")
    @Operation(operationId = "confirmTripDeliveryStep",
            summary = "Confirms a step of the delivery (delivered, accepted, settled) in the order of the cycle")
    @PermissionsAllowed(value = TripsAccessCatalog.DELIVERY_OPERATE, permission = OrgPermission.class,
            params = ORG)
    public Uni<Response> confirm(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            @PathParam(DELIVERY) String deliveryId, @PathParam(STEP) String step, ConfirmRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(deliveries.confirm(tenant, actor, uuid(id, ID), uuid(deliveryId, DELIVERY),
                step, body == null ? null : body.at(), channel(body == null ? null : body.channel()),
                body == null ? null : body.note(), body == null ? null : body.evidence())).build());
    }

    @POST
    @Path("/{deliveryId}/steps/{step}/reject")
    @Operation(operationId = "rejectTripDeliveryStep", summary = "Rejects the pending request of a delivery step")
    @PermissionsAllowed(value = TripsAccessCatalog.DELIVERY_OPERATE, permission = OrgPermission.class,
            params = ORG)
    public Uni<Response> reject(@PathParam(ORG) String organizationId, @PathParam(ID) String id,
            @PathParam(DELIVERY) String deliveryId, @PathParam(STEP) String step, RejectRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(deliveries.reject(tenant, actor, uuid(id, ID), uuid(deliveryId, DELIVERY),
                step, channel(body == null ? null : body.channel()), body == null ? null : body.note())).build());
    }

    private static String channel(String channel) {
        if (channel == null || channel.isBlank()) {
            return "api";
        }
        if (!"ui".equals(channel) && !"api".equals(channel)) {
            throw new IllegalArgumentException("channel must be ui or api");
        }
        return channel;
    }

    private static Map<String, Object> metadata(String text) {
        if (text == null || text.isBlank()) {
            return Map.of();
        }
        try {
            return JSON.readValue(text, new TypeReference<Map<String, Object>>() {
            });
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("metadata must be a JSON object");
        }
    }
}
