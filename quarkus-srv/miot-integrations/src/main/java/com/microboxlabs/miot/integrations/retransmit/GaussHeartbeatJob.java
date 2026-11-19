package com.microboxlabs.miot.integrations.retransmit;

import io.quarkus.scheduler.Scheduled;
import io.vertx.core.json.JsonObject;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Gauss Control <em>API de Heartbeat</em> ({@code POST /v1/processor/events/heartbeat}).
 *
 * <p>{@link RetransmitDeliveryJob} records every device whose position Gauss accepted.
 * Every {@code heartbeat.every} this job sends one heartbeat per device seen within
 * {@code heartbeat.window}: {@code message=ok} while its last position is newer than
 * {@code heartbeat.stale-after}, {@code stale} after that. The device list lives in
 * memory and refills from deliveries after a restart.
 */
@ApplicationScoped
public class GaussHeartbeatJob {

    private static final Logger LOG = Logger.getLogger(GaussHeartbeatJob.class);
    private static final Duration HTTP_TIMEOUT = Duration.ofSeconds(15);
    static final String HEARTBEAT_PATH = "/v1/processor/events/heartbeat";
    private static final DateTimeFormatter GAUSS_TIME =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneOffset.UTC);

    private final GaussAuthClient gaussAuth;
    private final boolean enabled;
    private final Optional<String> url;
    private final Duration window;
    private final Duration staleAfter;
    private final String deviceBrand;
    private final boolean logTraffic;
    private final Clock clock;
    private final HttpClient httpClient;
    private final Map<String, Device> devices = new ConcurrentHashMap<>();

    @Inject
    GaussHeartbeatJob(
            GaussAuthClient gaussAuth,
            @ConfigProperty(name = "miot.integrations.retransmit.gauss.heartbeat.enabled", defaultValue = "false")
                    boolean enabled,
            @ConfigProperty(name = "miot.integrations.retransmit.gauss.heartbeat.url") Optional<String> url,
            @ConfigProperty(name = "miot.integrations.retransmit.gauss.heartbeat.window", defaultValue = "30m")
                    Duration window,
            @ConfigProperty(name = "miot.integrations.retransmit.gauss.heartbeat.stale-after", defaultValue = "10m")
                    Duration staleAfter,
            @ConfigProperty(name = "miot.integrations.retransmit.gauss.device-brand", defaultValue = "streamhub")
                    String deviceBrand,
            @ConfigProperty(name = "miot.integrations.retransmit.gauss.log-traffic", defaultValue = "false")
                    boolean logTraffic) {
        this(gaussAuth, enabled, url, window, staleAfter, deviceBrand, logTraffic, Clock.systemUTC(),
                HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(5))
                        .followRedirects(HttpClient.Redirect.NEVER)
                        .build());
    }

    GaussHeartbeatJob(
            GaussAuthClient gaussAuth,
            boolean enabled,
            Optional<String> url,
            Duration window,
            Duration staleAfter,
            String deviceBrand,
            boolean logTraffic,
            Clock clock,
            HttpClient httpClient) {
        this.gaussAuth = gaussAuth;
        this.enabled = enabled;
        this.url = url.filter(u -> !u.isBlank());
        this.window = window;
        this.staleAfter = staleAfter;
        this.deviceBrand = deviceBrand == null || deviceBrand.isBlank() ? "streamhub" : deviceBrand.trim();
        this.logTraffic = logTraffic;
        this.clock = clock;
        this.httpClient = httpClient;
    }

    /** Remembers a device after Gauss accepted its position ({@code position} is the Gauss v2 object). */
    void record(JsonObject position, String destinationUrl) {
        if (!enabled || position == null) {
            return;
        }
        String deviceId = position.getString("deviceId");
        if (deviceId == null || deviceId.isBlank()) {
            return;
        }
        Instant signalAt = parseGaussTime(position.getString("start"));
        devices.merge(
                deviceId,
                new Device(
                        deviceId,
                        position.getString("deviceType"),
                        position.getString("deviceModel"),
                        position.getString("vehicleCode"),
                        position.getString("driverCode"),
                        destinationUrl,
                        signalAt != null ? signalAt : clock.instant(),
                        clock.instant()),
                (old, fresh) -> fresh.signalAt().isBefore(old.signalAt()) ? old : fresh);
    }

    @Scheduled(
            every = "${miot.integrations.retransmit.gauss.heartbeat.every:5m}",
            delayed = "1m",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void sendHeartbeats() {
        if (!enabled) {
            return;
        }
        Instant now = clock.instant();
        devices.values().removeIf(d -> d.seenAt().isBefore(now.minus(window)));
        List<Device> batch = List.copyOf(devices.values());
        if (batch.isEmpty()) {
            return;
        }
        int ok = 0;
        int rejected = 0;
        int failed = 0;
        for (Device device : batch) {
            switch (send(device, now)) {
                case OK -> ok++;
                case REJECTED -> rejected++;
                case FAILED -> failed++;
            }
        }
        LOG.infof("Gauss heartbeat sent=%d ok=%d rejected=%d failed=%d", batch.size(), ok, rejected, failed);
    }

    private Outcome send(Device device, Instant now) {
        String target = heartbeatUrl(device.destinationUrl());
        if (target == null) {
            LOG.warnf("Gauss heartbeat skipped device=%s: no heartbeat URL", device.deviceId());
            return Outcome.FAILED;
        }
        String body = toHeartbeat(device, now).encode();
        try {
            HttpRequest.Builder req = HttpRequest.newBuilder()
                    .uri(URI.create(target))
                    .timeout(HTTP_TIMEOUT)
                    .header("Content-Type", "application/json")
                    .header("User-Agent", "ModularIoT-Retransmit/1.0");
            gaussAuth.applyAuthHeaders(req);
            if (logTraffic) {
                LOG.infof("Gauss heartbeat REQUEST url=%s body=%s", target, body);
            }
            HttpResponse<String> response = httpClient.send(
                    req.POST(HttpRequest.BodyPublishers.ofString(body)).build(),
                    HttpResponse.BodyHandlers.ofString());
            int code = response.statusCode();
            if (logTraffic) {
                LOG.infof("Gauss heartbeat RESPONSE device=%s status=%d body=%s",
                        device.deviceId(), code, response.body());
            }
            if (code >= 200 && code < 300) {
                return Outcome.OK;
            }
            if (code == 401) {
                gaussAuth.invalidate();
            }
            LOG.warnf("Gauss heartbeat device=%s vehicle=%s status=%d body=%s",
                    device.deviceId(), device.vehicleCode(), code, truncate(response.body()));
            return code == 400 || code == 422 ? Outcome.REJECTED : Outcome.FAILED;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Outcome.FAILED;
        } catch (Exception e) {
            LOG.warnf("Gauss heartbeat device=%s failed: %s", device.deviceId(), e.getMessage());
            return Outcome.FAILED;
        }
    }

    JsonObject toHeartbeat(Device device, Instant now) {
        JsonObject context = new JsonObject();
        if (device.vehicleCode() != null) {
            context.put("vehicleCode", device.vehicleCode());
        }
        if (device.driverCode() != null && !device.driverCode().isBlank()) {
            context.put("driverCode", device.driverCode());
        }
        boolean fresh = !device.signalAt().isBefore(now.minus(staleAfter));
        context.put("message", fresh ? "ok" : "stale");
        return new JsonObject()
                .put("timestamp", GAUSS_TIME.format(now))
                .put("deviceId", device.deviceId())
                .put("deviceType", device.deviceType() != null ? device.deviceType() : "GPS")
                .put("deviceModel", device.deviceModel() != null ? device.deviceModel() : "streamhub-miot")
                .put("deviceBrand", deviceBrand)
                .put("context", context);
    }

    /** Configured URL, else the position URL's origin + {@value #HEARTBEAT_PATH}. */
    String heartbeatUrl(String destinationUrl) {
        if (url.isPresent()) {
            return url.get().trim();
        }
        if (destinationUrl == null || destinationUrl.isBlank()) {
            return null;
        }
        try {
            URI uri = URI.create(destinationUrl.trim());
            if (uri.getScheme() == null || uri.getRawAuthority() == null) {
                return null;
            }
            return uri.getScheme() + "://" + uri.getRawAuthority() + HEARTBEAT_PATH;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    int trackedDevices() {
        return devices.size();
    }

    static Instant parseGaussTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value.trim(), DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
                    .toInstant(ZoneOffset.UTC);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static String truncate(String body) {
        if (body == null) {
            return "";
        }
        return body.length() > 500 ? body.substring(0, 500) : body;
    }

    private enum Outcome { OK, REJECTED, FAILED }

    record Device(
            String deviceId,
            String deviceType,
            String deviceModel,
            String vehicleCode,
            String driverCode,
            String destinationUrl,
            Instant signalAt,
            Instant seenAt) {}
}
