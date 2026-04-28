package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.alfresco.AlfrescoPerson;
import com.microboxlabs.miot.core.alfresco.IAlfrescoDirectoryClient;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import java.util.List;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Directory-wide people search. Used by the admin UI to find users when
 * assigning them to an organization (e.g. "search for Cris, add to TRAZA").
 *
 * <p>Phase 1 gating: any authenticated caller. Phase 4 will tighten this to
 * require {@code SITE_MANAGER} on at least one parent organization — the same
 * role that can create sub-accounts and toggle modules.
 */
@Path("/api/v1/people")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "People", description = "Search the Alfresco people directory")
@SecurityRequirement(name = "oidc")
public class PeopleResource {

    private final IAlfrescoDirectoryClient directoryClient;

    @Inject
    public PeopleResource(IAlfrescoDirectoryClient directoryClient) {
        this.directoryClient = directoryClient;
    }

    @GET
    @Operation(summary = "Search people by free-text query")
    public Uni<List<AlfrescoPerson>> search(
            @QueryParam("q") String query,
            @QueryParam("maxItems") @DefaultValue("20") int maxItems) {
        return directoryClient.searchPeople(query, maxItems);
    }
}
