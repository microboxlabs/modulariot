package com.microboxlabs.miot.core.auth0;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import java.util.List;
import java.util.Map;

/** The Auth0 token endpoint and the parts of the Management API v2 that {@link Auth0Management} uses. */
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public interface Auth0ManagementApi {

    String AUTHORIZATION = "Authorization";

    @POST
    @Path("/oauth/token")
    Uni<TokenResponse> token(TokenRequest request);

    @POST
    @Path("/api/v2/clients")
    Uni<Client> createClient(@HeaderParam(AUTHORIZATION) String authorization, NewClient client);

    @DELETE
    @Path("/api/v2/clients/{id}")
    Uni<Void> deleteClient(@HeaderParam(AUTHORIZATION) String authorization, @PathParam("id") String clientId);

    @GET
    @Path("/api/v2/clients/{id}")
    Uni<Client> client(@HeaderParam(AUTHORIZATION) String authorization, @PathParam("id") String clientId,
            @QueryParam("fields") String fields, @QueryParam("include_fields") boolean includeFields);

    @GET
    @Path("/api/v2/clients")
    Uni<List<Client>> clients(@HeaderParam(AUTHORIZATION) String authorization,
            @QueryParam("app_type") String appType, @QueryParam("fields") String fields,
            @QueryParam("include_fields") boolean includeFields, @QueryParam("page") int page,
            @QueryParam("per_page") int perPage);

    @POST
    @Path("/api/v2/clients/{id}/rotate-secret")
    Uni<Client> rotateSecret(@HeaderParam(AUTHORIZATION) String authorization, @PathParam("id") String clientId);

    @POST
    @Path("/api/v2/client-grants")
    Uni<Map<String, Object>> createGrant(@HeaderParam(AUTHORIZATION) String authorization, ClientGrant grant);

    record TokenRequest(@JsonProperty("client_id") String clientId,
            @JsonProperty("client_secret") String clientSecret,
            String audience,
            @JsonProperty("grant_type") String grantType) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record TokenResponse(@JsonProperty("access_token") String accessToken,
            @JsonProperty("expires_in") long expiresIn) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record NewClient(String name,
            String description,
            @JsonProperty("app_type") String appType,
            @JsonProperty("grant_types") List<String> grantTypes,
            @JsonProperty("token_endpoint_auth_method") String tokenEndpointAuthMethod,
            @JsonProperty("client_metadata") Map<String, String> clientMetadata) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Client(@JsonProperty("client_id") String clientId,
            String name,
            @JsonProperty("app_type") String appType,
            @JsonProperty("client_secret") String clientSecret) {
    }

    record ClientGrant(@JsonProperty("client_id") String clientId, String audience, List<String> scope) {
    }
}
