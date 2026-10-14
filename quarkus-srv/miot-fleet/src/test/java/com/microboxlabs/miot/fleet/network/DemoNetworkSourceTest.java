package com.microboxlabs.miot.fleet.network;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** The demo network, resolved for the viewer, shows each kind of access the class documents. */
class DemoNetworkSourceTest {

    private static final Instant NOW = Instant.parse("2026-10-14T12:00:00Z");

    @Test
    void theViewerSeesWhatTheDemoDescribes() {
        NetworkSnapshot snapshot = new DemoNetworkSource(() -> NOW).load(new Viewer("acme", "acme-client"));
        NetworkResolver resolver = new NetworkResolver(snapshot, new NetworkPolicy(Map.of(
                EvidenceSource.SIGNAL, Duration.ofDays(30),
                EvidenceSource.TRIP, Duration.ofDays(7),
                EvidenceSource.ACCREDITATION, Duration.ofDays(30))), NOW);

        assertEquals(Set.of("ABCD12", "EFGH34", "IJKL56", "JAULA-01", "SEN-0001"),
                Set.copyOf(resolver.assets("acme").stream().map(AssetView::id).toList()));
        assertEquals(List.of(DemoNetworkSource.ANDES, DemoNetworkSource.PACIFICO),
                resolver.relationships("acme").stream().map(r -> r.counterpart().id()).toList());
        assertEquals(Set.of("ABCD12", "EFGH34", "JAULA-01", "QRST90"),
                Set.copyOf(resolver.assets(DemoNetworkSource.ANDES).stream().map(AssetView::id).toList()));
    }
}
