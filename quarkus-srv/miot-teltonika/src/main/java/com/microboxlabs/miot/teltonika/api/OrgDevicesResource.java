package com.microboxlabs.miot.teltonika.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.teltonika.access.DevicesAccessCatalog;
import com.microboxlabs.miot.teltonika.service.DeviceService;
import com.microboxlabs.miot.teltonika.service.DeviceService.DeviceRequest;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * The organization's directly connected GPS devices: register by IMEI, assign to an asset, read
 * the connection guide, health, installation check and kept packets, send commands and run
 * intensive tracking. The organization's GPS client id (the one in Ajustes › Integración GPS) is the
 * tenant every record of its devices is published with.
 */
@Path("/api/v1/orgs/{organizationId}/gps/devices")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "GPS — Direct devices", description = "GPS devices connected directly to the platform")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.teltonika.enabled", stringValue = "true")
public class OrgDevicesResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";
    private static final String IMEI = "imei";

    private final DeviceService devices;

    /** Body of a registration. */
    public record CreateRequest(String imei, String model, String label, String assetId, String assignedFrom) {
    }

    /** Body of an edit; null fields are kept. */
    public record UpdateRequest(String model, String label) {
    }

    /** Body of a reassignment; {@code from} null means now. */
    public record AssignRequest(String assetId, String from) {
    }

    /** Body of a capture or intensive tracking. */
    public record DurationRequest(Integer minutes, String reason) {
    }

    /** Body of a command. */
    public record CommandRequest(String command) {
    }

    /** Profiles of a device; null removes one. */
    public record ProfilesRequest(UUID configProfileId, UUID inputProfileId) {
    }

    @Inject
    public OrgDevicesResource(TenantContext tenantContext, OrganizationContext organizationContext,
            OrganizationRoleService roleService, SecurityIdentity identity, DeviceService devices) {
        super(tenantContext, organizationContext, roleService, identity);
        this.devices = devices;
    }

    @GET
    @Operation(operationId = "listDevices", summary = "The organization's devices with their current asset")
    @PermissionsAllowed(value = DevicesAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> list(@PathParam(ORG) String organizationId, @QueryParam("active") Boolean active) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(devices.list(tenant, active)).build());
    }

    @POST
    @Operation(operationId = "registerDevice", summary = "Registers a device by IMEI and assigns it to an asset")
    @PermissionsAllowed(value = DevicesAccessCatalog.WRITE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> register(@PathParam(ORG) String organizationId, CreateRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> {
            CreateRequest b = required(body);
            return Response.status(Response.Status.CREATED).entity(devices.register(tenant,
                    new DeviceRequest(b.imei(), b.model(), b.label(), b.assetId(), time(b.assignedFrom(), "assignedFrom")),
                    actor)).build();
        });
    }

    @GET
    @Path("/{imei}")
    @Operation(operationId = "getDevice", summary = "One device with every asset assignment")
    @PermissionsAllowed(value = DevicesAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> get(@PathParam(ORG) String organizationId, @PathParam(IMEI) String imei) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(devices.get(tenant, imei)).build());
    }

    @PUT
    @Path("/{imei}")
    @Operation(operationId = "updateDevice", summary = "Changes the model or label of a device")
    @PermissionsAllowed(value = DevicesAccessCatalog.WRITE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> update(@PathParam(ORG) String organizationId, @PathParam(IMEI) String imei,
            UpdateRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> {
            UpdateRequest b = required(body);
            return Response.ok(devices.update(tenant, imei, b.model(), b.label(), actor)).build();
        });
    }

    @DELETE
    @Path("/{imei}")
    @Operation(operationId = "deactivateDevice", summary = "Deactivates a device: its connections are refused")
    @PermissionsAllowed(value = DevicesAccessCatalog.WRITE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> deactivate(@PathParam(ORG) String organizationId, @PathParam(IMEI) String imei) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(devices.deactivate(tenant, imei, actor)).build());
    }

    @POST
    @Path("/{imei}/assignments")
    @Operation(operationId = "assignDevice", summary = "The device reports for another asset from now or a given time")
    @PermissionsAllowed(value = DevicesAccessCatalog.WRITE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> assign(@PathParam(ORG) String organizationId, @PathParam(IMEI) String imei,
            AssignRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> {
            AssignRequest b = required(body);
            return Response.ok(devices.reassign(tenant, imei, b.assetId(), time(b.from(), "from"), actor)).build();
        });
    }

    @GET
    @Path("/{imei}/connection")
    @Operation(operationId = "deviceConnectionGuide",
            summary = "Server, port and the parameters to load into the device, with setparam commands")
    @PermissionsAllowed(value = DevicesAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> connection(@PathParam(ORG) String organizationId, @PathParam(IMEI) String imei) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(devices.connection(tenant, imei)).build());
    }

    @GET
    @Path("/{imei}/health")
    @Operation(operationId = "deviceHealth", summary = "Last contact, last values and error counters")
    @PermissionsAllowed(value = DevicesAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> health(@PathParam(ORG) String organizationId, @PathParam(IMEI) String imei) {
        String tenant = tenantCode(organizationId);
        return work(() -> devices.health(tenant, imei)
                .map(s -> Response.ok(s).build())
                .orElseGet(() -> Response.ok(Map.of("imei", imei, "seen", false)).build()));
    }

    @GET
    @Path("/{imei}/installation-check")
    @Operation(operationId = "deviceInstallationCheck",
            summary = "Whether the installed device reports, has a fix, sees the ignition and has power")
    @PermissionsAllowed(value = DevicesAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> installationCheck(@PathParam(ORG) String organizationId, @PathParam(IMEI) String imei) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(devices.installationCheck(tenant, imei)).build());
    }

    @GET
    @Path("/{imei}/packets")
    @Operation(operationId = "devicePackets",
            summary = "Packets kept for the device: errors, quarantine, records not published, captures")
    @PermissionsAllowed(value = DevicesAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> packets(@PathParam(ORG) String organizationId, @PathParam(IMEI) String imei,
            @QueryParam("limit") String limit) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(devices.packets(tenant, imei, integer(limit, "limit"))).build());
    }

    @POST
    @Path("/{imei}/capture")
    @Operation(operationId = "captureDevicePackets", summary = "Keeps every packet of the device for some minutes")
    @PermissionsAllowed(value = DevicesAccessCatalog.WRITE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> capture(@PathParam(ORG) String organizationId, @PathParam(IMEI) String imei,
            DurationRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(devices.capture(tenant, imei, minutes(body), actor)).build());
    }

    @GET
    @Path("/{imei}/commands")
    @Operation(operationId = "listDeviceCommands", summary = "Commands sent to the device and their answers")
    @PermissionsAllowed(value = DevicesAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> commands(@PathParam(ORG) String organizationId, @PathParam(IMEI) String imei,
            @QueryParam("limit") String limit) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(devices.commands(tenant, imei, integer(limit, "limit"))).build());
    }

    @POST
    @Path("/{imei}/commands")
    @Operation(operationId = "sendDeviceCommand",
            summary = "Queues a query (getinfo, getgps…) or a reporting-frequency setparam")
    @PermissionsAllowed(value = DevicesAccessCatalog.COMMAND, permission = OrgPermission.class, params = ORG)
    public Uni<Response> command(@PathParam(ORG) String organizationId, @PathParam(IMEI) String imei,
            CommandRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.status(Response.Status.ACCEPTED)
                .entity(devices.command(tenant, imei, required(body).command(), actor)).build());
    }

    @POST
    @Path("/{imei}/intensive-tracking")
    @Operation(operationId = "startIntensiveTracking",
            summary = "Raises the reporting frequency for some minutes, then restores the standard one")
    @PermissionsAllowed(value = DevicesAccessCatalog.COMMAND, permission = OrgPermission.class, params = ORG)
    public Uni<Response> startIntensive(@PathParam(ORG) String organizationId, @PathParam(IMEI) String imei,
            DurationRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.status(Response.Status.ACCEPTED).entity(devices.startIntensive(tenant, imei,
                minutes(body), body == null ? null : body.reason(), actor)).build());
    }

    @DELETE
    @Path("/{imei}/intensive-tracking")
    @Operation(operationId = "endIntensiveTracking", summary = "Restores the standard reporting frequency now")
    @PermissionsAllowed(value = DevicesAccessCatalog.COMMAND, permission = OrgPermission.class, params = ORG)
    public Uni<Response> endIntensive(@PathParam(ORG) String organizationId, @PathParam(IMEI) String imei) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> {
            devices.endIntensive(tenant, imei, actor);
            return Response.noContent().build();
        });
    }

    @GET
    @Path("/models")
    @Operation(operationId = "listDeviceModels",
            summary = "Models the platform receives: native Teltonika and other brands through Traccar")
    @PermissionsAllowed(value = DevicesAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> models(@PathParam(ORG) String organizationId) {
        tenantCode(organizationId);
        return work(() -> Response.ok(devices.models()).build());
    }

    @PUT
    @Path("/{imei}/profiles")
    @Operation(operationId = "setDeviceProfiles", summary = "Assigns the configuration and input profiles of a device")
    @PermissionsAllowed(value = DevicesAccessCatalog.WRITE, permission = OrgPermission.class, params = ORG)
    public Uni<Response> setProfiles(@PathParam(ORG) String organizationId, @PathParam(IMEI) String imei,
            ProfilesRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> {
            ProfilesRequest b = required(body);
            return Response.ok(devices.setProfiles(tenant, imei, b.configProfileId(), b.inputProfileId(), false,
                    actor)).build();
        });
    }

    @POST
    @Path("/{imei}/profiles/apply")
    @Operation(operationId = "applyDeviceConfigProfile",
            summary = "Sends the device's configuration profile to it (setparam commands)")
    @PermissionsAllowed(value = DevicesAccessCatalog.COMMAND, permission = OrgPermission.class, params = ORG)
    public Uni<Response> applyProfile(@PathParam(ORG) String organizationId, @PathParam(IMEI) String imei) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> {
            var d = devices.get(tenant, imei).device();
            if (d.configProfileId() == null) {
                throw new IllegalStateException("the device has no configuration profile");
            }
            return Response.status(Response.Status.ACCEPTED).entity(devices.setProfiles(tenant, imei,
                    d.configProfileId(), d.inputProfileId(), true, actor)).build();
        });
    }

    private static <T> T required(T body) {
        if (body == null) {
            throw new IllegalArgumentException("a request body is required");
        }
        return body;
    }

    private static Duration minutes(DurationRequest body) {
        if (body == null || body.minutes() == null) {
            throw new IllegalArgumentException("minutes is required");
        }
        return Duration.ofMinutes(body.minutes());
    }

    private static OffsetDateTime time(String raw, String field) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(raw.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException(field + " must be an ISO-8601 date-time with offset");
        }
    }
}
