package com.microboxlabs.miot.teltonika.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.teltonika.api.OrgDevicesResource.AssignRequest;
import com.microboxlabs.miot.teltonika.api.OrgDevicesResource.CommandRequest;
import com.microboxlabs.miot.teltonika.api.OrgDevicesResource.CreateRequest;
import com.microboxlabs.miot.teltonika.api.OrgDevicesResource.DurationRequest;
import com.microboxlabs.miot.teltonika.command.CommandService;
import com.microboxlabs.miot.teltonika.command.DeviceCommand;
import com.microboxlabs.miot.teltonika.device.AssetDirectory;
import com.microboxlabs.miot.teltonika.device.CachedDeviceRegistry;
import com.microboxlabs.miot.teltonika.guide.ConnectionGuide;
import com.microboxlabs.miot.teltonika.service.DeviceService;
import com.microboxlabs.miot.teltonika.service.DeviceService.DeviceDetail;
import com.microboxlabs.miot.teltonika.store.InMemoryStores;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.core.Response;
import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The tenant and the actor come from the session, never from the body; errors map to HTTP. */
class OrgDevicesResourceTest {

    private static final String ORG = "acme";
    private static final String IMEI = "356307042441013";
    private static final Duration WAIT = Duration.ofSeconds(5);

    private final InMemoryStores.Set stores = InMemoryStores.Set.create();
    private final DeviceService service = new DeviceService(stores.devices(), stores.monitor(), stores.commands(),
            new CommandService(stores.commands(), Clock.systemUTC()), new CachedDeviceRegistry(stores.devices()),
            new ConnectionGuide("devices.example.com", 5027), AssetDirectory.open(),
            new DeviceService.Settings(false, Duration.ofHours(72), Duration.ofDays(7)), Clock.systemUTC());

    private OrgDevicesResource resource(String tenant) {
        OrganizationContext org = new OrganizationContext();
        org.setOrganizationId(ORG);
        org.setUserEmail("ana@example.com");
        TenantContext ctx = new TenantContext();
        ctx.setClientId(tenant);
        ctx.setTenantCode(tenant);
        return new OrgDevicesResource(ctx, org, null, null, service);
    }

    @Test
    void registerUsesTheSessionTenantAndActor() {
        Response created = call(resource("acme-client").register(ORG, new CreateRequest(IMEI, null, "grúa", "ABCD12", null)));

        assertEquals(201, created.getStatus());
        DeviceDetail detail = (DeviceDetail) created.getEntity();
        assertEquals("ana@example.com", detail.device().createdBy());
        assertEquals("acme-client", stores.devices().find(IMEI).orElseThrow().tenantCode());
    }

    @Test
    void errorsMapToHttp() {
        var acme = resource("acme-client");
        assertEquals(400, call(acme.register(ORG, new CreateRequest("123", null, null, "ABCD12", null))).getStatus());
        assertEquals(400, call(acme.register(ORG, null)).getStatus());
        call(acme.register(ORG, new CreateRequest(IMEI, null, null, "ABCD12", null)));
        assertEquals(409, call(acme.register(ORG, new CreateRequest(IMEI, null, null, "ABCD12", null))).getStatus(),
                "the same organization is told it already has it");
        assertEquals(404, call(resource("other-client").register(ORG,
                new CreateRequest(IMEI, null, null, "ZZZZ99", null))).getStatus(),
                "another organization is not told the IMEI exists");
        assertEquals(404, call(resource("other-client").get(ORG, IMEI)).getStatus(),
                "another organization's device does not exist for it");
        assertEquals(400, call(acme.assign(ORG, IMEI, new AssignRequest("EFGH34", "yesterday"))).getStatus());
        assertEquals(400, call(acme.command(ORG, IMEI, new CommandRequest("setdigout 1"))).getStatus());
        assertEquals(409, call(acme.endIntensive(ORG, IMEI)).getStatus(), "not in intensive tracking");
    }

    @Test
    void commandsAndIntensiveTrackingAreAccepted() {
        var acme = resource("acme-client");
        call(acme.register(ORG, new CreateRequest(IMEI, null, null, "ABCD12", null)));

        Response command = call(acme.command(ORG, IMEI, new CommandRequest("getinfo")));
        assertEquals(202, command.getStatus());
        assertEquals(DeviceCommand.PENDING, ((DeviceCommand) command.getEntity()).status());
        assertEquals(202, call(acme.startIntensive(ORG, IMEI, new DurationRequest(30, "caso 1"))).getStatus());
        assertEquals(204, call(acme.endIntensive(ORG, IMEI)).getStatus());
        // getinfo + 4 reads of the current frequency + the raise + the restore
        assertEquals(7, stores.commands().all().size());
    }

    @Test
    void readEndpointsOfANewDevice() {
        var acme = resource("acme-client");
        call(acme.register(ORG, new CreateRequest(IMEI, "FMC920", null, "ABCD12", null)));

        assertEquals(200, call(acme.connection(ORG, IMEI)).getStatus());
        Response health = call(acme.health(ORG, IMEI));
        assertEquals(false, ((Map<?, ?>) health.getEntity()).get("seen"));
        assertEquals(200, call(acme.installationCheck(ORG, IMEI)).getStatus());
        assertTrue(((java.util.List<?>) call(acme.packets(ORG, IMEI, null)).getEntity()).isEmpty());
        assertEquals(200, call(acme.capture(ORG, IMEI, new DurationRequest(15, null))).getStatus());
    }

    private static Response call(Uni<Response> uni) {
        return uni.await().atMost(WAIT);
    }
}
