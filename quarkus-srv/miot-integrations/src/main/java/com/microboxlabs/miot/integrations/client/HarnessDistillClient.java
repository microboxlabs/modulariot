package com.microboxlabs.miot.integrations.client;

import com.microboxlabs.miot.integrations.dto.DistillResponse;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.Map;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

/**
 * REST client for the harness DISTILL seam — {@code POST
 * /connections/{connection}/distill}. Reuses the {@code "harness"} binding
 * ({@code quarkus.rest-client."harness".url} ← {@code MIOT_HARNESS_BASE_URL})
 * that miot-core's {@code HarnessClient} already configures, so there is a single
 * harness URL.
 *
 * <p>Unlike the user-facing proxy (which forwards a caller's bearer), this is
 * called by the background {@code KnowledgeDistillerJob}, which has no inbound
 * request. It sends the tenant header ({@code interaction_episodes.tenant_code}
 * already equals the org {@code tenant_client_id}) and, in an auth-enabled
 * deployment, a service bearer supplied by ops. Dev/local harness runs
 * auth-disabled, so the header alone suffices there; provisioning the prod M2M
 * credential (and, ideally, an OIDC client to refresh it) is an ops prereq —
 * the job stays OFF by default until then.
 */
@RegisterRestClient(configKey = "harness")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public interface HarnessDistillClient {

    @POST
    @Path("/connections/{connection}/distill")
    DistillResponse distill(
            @PathParam("connection") String connection,
            @HeaderParam("X-Miot-Tenant-Client-Id") String tenantClientId,
            @HeaderParam("X-Miot-Auth-Mode") String authMode,
            @HeaderParam("Authorization") String authorization,
            Map<String, Object> body);
}
