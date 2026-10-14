package com.microboxlabs.miot.fleet.network;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;

/**
 * Fictional network around the viewer, which plays a logistics operator. Two carriers, two GPS providers and a second
 * operator; each kind of access appears at least once:
 *
 * <table>
 *   <caption>Assets and what the viewer sees</caption>
 *   <tr><th>Asset</th><th>Viewer</th></tr>
 *   <tr><td>ABCD12</td><td>operates it on an open trip</td></tr>
 *   <tr><td>JAULA-01, SEN-0001</td><td>linked to ABCD12 on that trip (trailer, decoy)</td></tr>
 *   <tr><td>EFGH34</td><td>trip closed 3 days ago, still within the trip TTL</td></tr>
 *   <tr><td>IJKL56</td><td>accredited until a fixed date</td></tr>
 *   <tr><td>MNOP78</td><td>trip closed 20 days ago: expired, not visible</td></tr>
 *   <tr><td>QRST90</td><td>operated only by the other operator: not visible</td></tr>
 * </table>
 */
public final class DemoNetworkSource implements NetworkSource {

    static final String ANDES = "demo-transportes-andes";
    static final String PACIFICO = "demo-transportes-pacifico";
    static final String AUSTRAL = "demo-gps-austral";
    static final String RASTREO = "demo-rastreo-norte";
    static final String OTHER_OPERATOR = "demo-operador-sur";

    private static final String AUSTRAL_CLIENT = "demo-client-gps-austral";
    private static final String RASTREO_CLIENT = "demo-client-rastreo-norte";

    private final Supplier<Instant> clock;

    public DemoNetworkSource(Supplier<Instant> clock) {
        this.clock = clock;
    }

    @Override
    public NetworkSnapshot load(Viewer viewer) {
        Instant now = clock.get();
        String me = viewer.organizationId();
        Set<String> myClients = viewer.clientId() == null ? Set.of() : Set.of(viewer.clientId());

        List<NetworkOrganization> organizations = List.of(
                new NetworkOrganization(me, me, Set.of(OrgRole.OPERATOR), myClients),
                new NetworkOrganization(ANDES, "Transportes Andes (demo)", Set.of(OrgRole.CARRIER), Set.of()),
                new NetworkOrganization(PACIFICO, "Transportes Pacífico (demo)", Set.of(OrgRole.CARRIER), Set.of()),
                new NetworkOrganization(AUSTRAL, "GPS Austral (demo)", Set.of(OrgRole.PROVIDER),
                        Set.of(AUSTRAL_CLIENT)),
                new NetworkOrganization(RASTREO, "Rastreo Norte (demo)", Set.of(OrgRole.PROVIDER),
                        Set.of(RASTREO_CLIENT)),
                new NetworkOrganization(OTHER_OPERATOR, "Operador Sur (demo)", Set.of(OrgRole.OPERATOR), Set.of()));

        List<Asset> assets = List.of(
                new Asset("ABCD12", "Truck", "Tracto ABCD12"),
                new Asset("EFGH34", "Truck", "Tracto EFGH34"),
                new Asset("IJKL56", "TRACTO", "Tracto IJKL56"),
                new Asset("MNOP78", "Truck", "Tracto MNOP78"),
                new Asset("QRST90", "Truck", "Tracto QRST90"),
                new Asset("JAULA-01", "Jaula", "Jaula JAULA-01"),
                new Asset("SEN-0001", "Señuelo", "Señuelo en carga"));

        Instant monthsAgo = now.minus(Duration.ofDays(180));
        Instant minutesAgo = now.minus(Duration.ofMinutes(2));
        Instant closed3 = now.minus(Duration.ofDays(3));
        Instant closed20 = now.minus(Duration.ofDays(20));

        List<Evidence> evidence = List.of(
                reports(AUSTRAL_CLIENT, "ABCD12", monthsAgo, minutesAgo),
                reports(RASTREO_CLIENT, "EFGH34", monthsAgo, minutesAgo),
                reports(AUSTRAL_CLIENT, "IJKL56", monthsAgo, minutesAgo),
                reports(AUSTRAL_CLIENT, "MNOP78", monthsAgo, minutesAgo),
                reports(AUSTRAL_CLIENT, "QRST90", monthsAgo, minutesAgo),
                reports(AUSTRAL_CLIENT, "JAULA-01", monthsAgo, minutesAgo),
                reports(RASTREO_CLIENT, "SEN-0001", now.minus(Duration.ofDays(1)), minutesAgo),

                owns(ANDES, "ABCD12", EvidenceSource.TRIP, "T-1001", monthsAgo, now),
                owns(ANDES, "EFGH34", EvidenceSource.TRIP, "T-0987", monthsAgo, closed3),
                owns(ANDES, "JAULA-01", EvidenceSource.TRIP, "T-1001", monthsAgo, now),
                owns(ANDES, "QRST90", EvidenceSource.TRIP, "T-5501", monthsAgo, now),
                owns(PACIFICO, "IJKL56", EvidenceSource.ACCREDITATION, "ACR-2207", monthsAgo, now),
                owns(PACIFICO, "MNOP78", EvidenceSource.TRIP, "T-0901", monthsAgo, closed20),

                operates(me, "ABCD12", ANDES, EvidenceSource.TRIP, "T-1001", now.minus(Duration.ofHours(6)), now,
                        null),
                operates(me, "EFGH34", ANDES, EvidenceSource.TRIP, "T-0987", closed3.minus(Duration.ofHours(9)),
                        closed3, null),
                operates(me, "IJKL56", PACIFICO, EvidenceSource.ACCREDITATION, "ACR-2207", monthsAgo, now,
                        now.plus(Duration.ofDays(60))),
                operates(me, "MNOP78", PACIFICO, EvidenceSource.TRIP, "T-0901", closed20.minus(Duration.ofHours(7)),
                        closed20, null),
                operates(OTHER_OPERATOR, "QRST90", ANDES, EvidenceSource.TRIP, "T-5501",
                        now.minus(Duration.ofHours(3)), now, null),

                linked("ABCD12", "JAULA-01", "T-1001", now.minus(Duration.ofHours(6)), now),
                linked("ABCD12", "SEN-0001", "T-1001", now.minus(Duration.ofHours(6)), now));

        return new NetworkSnapshot(organizations, assets, evidence);
    }

    private static Evidence reports(String clientId, String assetId, Instant first, Instant last) {
        return new Evidence(EvidenceKind.REPORTS, clientId, assetId, null, EvidenceSource.SIGNAL, null, first, last,
                null);
    }

    private static Evidence owns(String carrier, String assetId, EvidenceSource source, String reference,
            Instant first, Instant last) {
        return new Evidence(EvidenceKind.OWNS, carrier, assetId, null, source, reference, first, last, null);
    }

    private static Evidence operates(String operator, String assetId, String carrier, EvidenceSource source,
            String reference, Instant first, Instant last, Instant validUntil) {
        return new Evidence(EvidenceKind.OPERATES, operator, assetId, carrier, source, reference, first, last,
                validUntil);
    }

    private static Evidence linked(String withAsset, String assetId, String trip, Instant first, Instant last) {
        return new Evidence(EvidenceKind.LINKED, withAsset, assetId, null, EvidenceSource.TRIP, trip, first, last,
                null);
    }
}
