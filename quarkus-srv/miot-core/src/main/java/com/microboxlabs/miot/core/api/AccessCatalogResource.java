package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.iam.AccessRegistry;
import com.microboxlabs.miot.core.iam.BaseRole;
import com.microboxlabs.miot.core.iam.PermissionDef;
import com.microboxlabs.miot.core.iam.RoleDef;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** The permissions, module roles and base roles this modulith knows. */
@Path("/api/v1/access/catalog")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Access", description = "The caller's access and the permission catalog")
@SecurityRequirement(name = "oidc")
@Authenticated
public class AccessCatalogResource {

    public record PermissionDto(String key, String module, Map<String, String> label, boolean explicitOnly,
            boolean ownerOnly) {
    }

    public record RoleDto(String key, String module, Map<String, String> label, Set<String> permissions) {
    }

    public record CatalogDto(List<String> baseRoles, List<PermissionDto> permissions, List<RoleDto> roles) {
    }

    private final AccessRegistry registry;

    @Inject
    public AccessCatalogResource(AccessRegistry registry) {
        this.registry = registry;
    }

    @GET
    @Operation(operationId = "getAccessCatalog",
            summary = "Every permission and module role, with labels per language, and the base roles")
    public CatalogDto catalog() {
        return new CatalogDto(
                Arrays.stream(BaseRole.values()).map(Enum::name).toList(),
                registry.permissions().stream().map(AccessCatalogResource::toDto).toList(),
                registry.roles().stream().map(AccessCatalogResource::toDto).toList());
    }

    private static PermissionDto toDto(PermissionDef p) {
        return new PermissionDto(p.key(), p.module(), p.label(), p.explicitOnly(), p.ownerOnly());
    }

    private static RoleDto toDto(RoleDef r) {
        return new RoleDto(r.key(), r.module(), r.label(), r.permissions());
    }
}
