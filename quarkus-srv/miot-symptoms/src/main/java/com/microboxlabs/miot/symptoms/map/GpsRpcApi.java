package com.microboxlabs.miot.symptoms.map;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;

/**
 * The StreamHub GPS database functions, called through PostgREST. Each function reads the caller's client id from
 * the token's {@code sub}, so a token for an organization's application returns only that organization's data.
 */
@Path("/rpc")
@Produces(MediaType.APPLICATION_JSON)
public interface GpsRpcApi {

    /** Last position of every asset; {@code all} includes assets that are not on a trip. */
    @GET
    @Path("/api_modular_map_positions")
    Uni<RpcResponse> positions(@HeaderParam("Authorization") String authorization,
            @QueryParam("p_is_dev") boolean all);

    @GET
    @Path("/api_modular_mapa_table_resume")
    Uni<RpcResponse> summary(@HeaderParam("Authorization") String authorization);

    /** Symptom counts by condition: active ones, or those created between {@code from} and {@code to}. */
    @GET
    @Path("/api_modular_symptoms_dashboard")
    Uni<RpcResponse> conditions(@HeaderParam("Authorization") String authorization,
            @QueryParam("p_start_date_historic") String from,
            @QueryParam("p_end_date_historic") String to);

    /** {@code status} is 200 with data, 204 without, or 4xx/5xx when the function failed. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    record RpcResponse(Integer status, String message, JsonNode data) {
    }
}
