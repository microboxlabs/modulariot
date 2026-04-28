package com.microboxlabs.miot.core.alfresco.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.rest.client.ext.ResponseExceptionMapper;
import org.jboss.logging.Logger;

/**
 * Translates non-2xx Alfresco REST responses into
 * {@link AlfrescoClientException}. Registered on {@link AlfrescoCoreApi}
 * via the {@code @RegisterProvider} chain; callers never see
 * {@code WebApplicationException}.
 *
 * <p>Alfresco's error JSON shape:
 * <pre>
 * { "error": { "errorKey": "framework.exception.InvalidArgument",
 *              "statusCode": 400,
 *              "briefSummary": "Group id must start with GROUP_" } }
 * </pre>
 */
public class AlfrescoExceptionMapper implements ResponseExceptionMapper<AlfrescoClientException> {

    private static final Logger LOG = Logger.getLogger(AlfrescoExceptionMapper.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public boolean handles(int status, jakarta.ws.rs.core.MultivaluedMap<String, Object> headers) {
        return status >= 400;
    }

    @Override
    public AlfrescoClientException toThrowable(Response response) {
        String errorKey = null;
        String briefSummary = null;
        try {
            if (response.hasEntity()) {
                String body = response.readEntity(String.class);
                if (body != null && !body.isBlank()) {
                    JsonNode node = MAPPER.readTree(body);
                    JsonNode err = node.get("error");
                    if (err != null) {
                        errorKey = textOrNull(err.get("errorKey"));
                        briefSummary = textOrNull(err.get("briefSummary"));
                    }
                }
            }
        } catch (Exception e) {
            LOG.debugf(e, "Could not parse Alfresco error body for status %d", response.getStatus());
        }
        return new AlfrescoClientException(response.getStatus(), errorKey, briefSummary);
    }

    private static String textOrNull(JsonNode node) {
        return node != null && !node.isNull() ? node.asText() : null;
    }
}
