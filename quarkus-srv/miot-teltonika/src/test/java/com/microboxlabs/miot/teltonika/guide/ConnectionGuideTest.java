package com.microboxlabs.miot.teltonika.guide;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.teltonika.guide.ConnectionGuide.Guide;
import com.microboxlabs.miot.teltonika.catalog.DeviceModel;
import com.microboxlabs.miot.teltonika.profile.ConfigProfile;
import java.util.LinkedHashMap;
import java.util.UUID;
import com.microboxlabs.miot.teltonika.guide.ConnectionGuide.Parameter;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class ConnectionGuideTest {

    private final ConnectionGuide guide = new ConnectionGuide("devices.example.com", 5027);

    @Test
    void serverProtocolAndStandardProfile() {
        Guide g = guide.guide("fmb920");
        Map<Integer, String> values = g.parameters().stream().collect(Collectors.toMap(Parameter::id, Parameter::value));

        assertEquals("FMB920", g.model());
        assertEquals("devices.example.com", values.get(2004));
        assertEquals("5027", values.get(2005));
        assertEquals("0", values.get(2006), "TCP");
        assertEquals("1", values.get(113), "Codec 8 Extended");
        assertEquals("1", values.get(1002), "oldest first");
        assertEquals("30", values.get(10050));
        assertEquals("0", values.get(102), "no sleep");
        assertTrue(g.gprsCommand().startsWith("setparam 2004:devices.example.com;2005:5027;2006:0;113:1"));
    }

    @Test
    void smsCommandsFitInOneMessageEachAndCoverEveryParameter() {
        Guide g = guide.guide("FMB920");
        String joined = g.smsCommands().stream().map(c -> c.trim().substring("setparam ".length()))
                .collect(Collectors.joining(";"));

        g.smsCommands().forEach(c -> {
            assertTrue(c.length() <= ConnectionGuide.SMS_LIMIT, c);
            assertTrue(c.startsWith("  setparam "), "two spaces when the device has no SMS login");
        });
        assertEquals(g.gprsCommand().substring("setparam ".length()), joined);
    }

    @Test
    void intensiveAndStandardProfilesChangeTheSameParameters() {
        assertEquals("setparam 10050:10;10055:10;10000:30;10005:30",
                ConnectionGuide.setparam(ConnectionGuide.intensiveProfile()));
        assertTrue(ConnectionGuide.setparam(ConnectionGuide.standardProfile()).contains("10050:30"));
    }

    @Test
    void theConfigurationProfileReplacesAndAddsParameters() {
        var profile = new ConfigProfile(UUID.randomUUID(), "acme", "Minería", null, "fmb9xx",
                new LinkedHashMap<>(Map.of(10050, "60", 102, "1", 50020, "2")), null, null, null, null);
        Guide g = guide.guide("FMB920", null, profile);

        assertEquals("60", value(g, 10050));
        assertEquals("1", value(g, 102));
        assertEquals("2", value(g, 50020));
        assertEquals("30", value(g, 10055), "parameters the profile does not set keep the standard value");
        assertTrue(g.parameters().stream().filter(p -> p.id() == 10050).findFirst().orElseThrow().reason()
                .contains("Minería"));
    }

    @Test
    void otherBrandsGetTheTraccarPortOfTheirProtocol() {
        var gt06 = new DeviceModel("GT06N", "Concox / Jimi", "GT06N", "gt06", DeviceModel.TRACCAR, 5023, null, false,
                null);
        Guide g = new ConnectionGuide("devices.example.com", 5027, "gw.example.com").traccarGuide(gt06);

        assertEquals("gw.example.com", g.host());
        assertEquals(5023, g.port());
        assertTrue(g.parameters().isEmpty());
        assertTrue(g.notes().stream().anyMatch(n -> n.contains("no verificado")));
    }

    private static String value(Guide g, int id) {
        return g.parameters().stream().filter(p -> p.id() == id).findFirst().orElseThrow().value();
    }
}
