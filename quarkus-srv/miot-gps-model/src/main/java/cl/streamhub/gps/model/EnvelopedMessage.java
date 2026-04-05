package cl.streamhub.gps.model;

import java.time.Instant;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import io.quarkus.runtime.annotations.RegisterForReflection;

@RegisterForReflection
public class EnvelopedMessage {
    
    private String requestId;
    private Instant timestamp;
    private String clientId;

    private AssetTrackingData payload;

    public String getRequestId() {
        return requestId;
    }

    public void setRequestId(String requestId) {
        this.requestId = requestId;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    public AssetTrackingData getPayload() {
        return payload;
    }

    public void setPayload(AssetTrackingData payload) {
        this.payload = payload;
    }

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public static EnvelopedMessage fromJson(String json) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
            mapper.registerModule(new JavaTimeModule());
            return mapper.readValue(json, EnvelopedMessage.class);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to deserialize EnvelopedMessage from JSON", e);
        }
    }
}
    