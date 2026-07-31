package com.microboxlabs.miot.integrations.client;

import com.microboxlabs.miot.integrations.dto.Auth0ApplicationRow;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import java.util.List;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

/**
 * Read-only view of the Auth0 application catalog, published by the
 * quarkus-auth0 service.
 *
 * <p>That service owns {@code public.applications} on its own database, so this
 * is an HTTP call and not a query: a second reader on another service's table
 * would freeze its schema and split ownership of a catalog that has exactly one
 * writer today.
 *
 * <p>It is also where the privileged credential stays. Listing applications
 * from Auth0 needs Management scopes, and a client holding those can mint a
 * grant for any audience — that is a platform credential, not a tenant one. It
 * belongs inside the service that already has it, behind an endpoint that
 * returns identifiers and names. Nothing on this side ever holds it.
 *
 * <p>The base URI defaults to the in-cluster service name and is overridden by
 * {@code quarkus.rest-client.auth0-admin.url}. It is declared on the annotation
 * rather than in a properties file because {@code miot-core} owns the only
 * {@code application.properties} the modulith loads, and a second one in this
 * module would risk shadowing it. Nothing is called until
 * {@code miot.integrations.auth0-directory.enabled} is true, so an unreachable
 * default costs nothing in a deployment that has not opted in.
 */
@RegisterRestClient(configKey = "auth0-admin", baseUri = "http://miot-auth0:8080")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public interface Auth0ApplicationsClient {

    /**
     * Lists machine-to-machine applications, optionally narrowed by a search term.
     *
     * @param query case-insensitive filter over name and client id; null for all
     * @param limit upper bound the caller is willing to render
     */
    @GET
    @Path("/api/v1/applications")
    List<Auth0ApplicationRow> list(
            @QueryParam("q") String query,
            @QueryParam("limit") int limit);
}
