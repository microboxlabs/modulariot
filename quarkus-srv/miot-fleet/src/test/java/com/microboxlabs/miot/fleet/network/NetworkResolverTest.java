package com.microboxlabs.miot.fleet.network;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class NetworkResolverTest {

    private static final Instant NOW = Instant.parse("2026-10-14T12:00:00Z");
    private static final NetworkPolicy POLICY = new NetworkPolicy(Map.of(
            EvidenceSource.SIGNAL, Duration.ofDays(30),
            EvidenceSource.TRIP, Duration.ofDays(7),
            EvidenceSource.ACCREDITATION, Duration.ofDays(30)));

    private static final NetworkOrganization OPERATOR =
            new NetworkOrganization("op", "Operator", Set.of(OrgRole.OPERATOR), Set.of("op-client"));
    private static final NetworkOrganization CARRIER =
            new NetworkOrganization("carrier", "Carrier", Set.of(OrgRole.CARRIER), Set.of());
    private static final NetworkOrganization PROVIDER =
            new NetworkOrganization("gps", "Provider", Set.of(OrgRole.PROVIDER), Set.of("gps-client"));

    private static Viewer v(String organizationId) {
        return new Viewer(organizationId, Set.of());
    }

    private static Instant daysAgo(int days) {
        return NOW.minus(Duration.ofDays(days));
    }

    private static Evidence evidence(EvidenceKind kind, String party, String asset, String counterparty,
            EvidenceSource source, Instant last, Instant validUntil) {
        return new Evidence(kind, party, asset, counterparty, source, "ref", daysAgo(100), last, validUntil);
    }

    private static NetworkResolver resolver(List<Evidence> evidence) {
        List<Asset> assets = List.of(new Asset("A1", "Truck", "A1"), new Asset("T1", "Jaula", "T1"),
                new Asset("A2", "Truck", "A2"));
        return new NetworkResolver(new NetworkSnapshot(List.of(OPERATOR, CARRIER, PROVIDER), assets, evidence),
                POLICY, NOW);
    }

    @Test
    void evidenceExpiresAtItsEndOrAfterTheSourceTtl() {
        Evidence trip = evidence(EvidenceKind.OPERATES, "op", "A1", "carrier", EvidenceSource.TRIP, daysAgo(2), null);
        Evidence accredited = evidence(EvidenceKind.OPERATES, "op", "A1", "carrier", EvidenceSource.ACCREDITATION,
                daysAgo(2), NOW.plus(Duration.ofDays(90)));
        assertEquals(daysAgo(2).plus(Duration.ofDays(7)), POLICY.expiresAt(trip));
        assertEquals(NOW.plus(Duration.ofDays(90)), POLICY.expiresAt(accredited));
    }

    @Test
    void eachPartySeesTheAssetForItsOwnReason() {
        NetworkResolver resolver = resolver(List.of(
                evidence(EvidenceKind.REPORTS, "gps-client", "A1", null, EvidenceSource.SIGNAL, NOW, null),
                evidence(EvidenceKind.OWNS, "carrier", "A1", null, EvidenceSource.TRIP, NOW, null),
                evidence(EvidenceKind.OPERATES, "op", "A1", "carrier", EvidenceSource.TRIP, NOW, null)));

        assertEquals(AccessReason.REPORTER, resolver.assets(v("gps")).get(0).access().get(0).reason());
        assertEquals(AccessReason.OWNER, resolver.assets(v("carrier")).get(0).access().get(0).reason());
        AssetView seenByOperator = resolver.assets(v("op")).get(0);
        assertEquals(AccessReason.OPERATOR, seenByOperator.access().get(0).reason());
        assertEquals("carrier", seenByOperator.owner().id());
        assertEquals(List.of("gps"), seenByOperator.providers().stream().map(OrgRef::id).toList());
    }

    @Test
    void expiredEvidenceGivesNoAccess() {
        NetworkResolver resolver = resolver(List.of(
                evidence(EvidenceKind.OPERATES, "op", "A1", "carrier", EvidenceSource.TRIP, daysAgo(8), null),
                evidence(EvidenceKind.OPERATES, "op", "A2", "carrier", EvidenceSource.TRIP, daysAgo(6), null)));
        assertEquals(List.of("A2"), resolver.assets(v("op")).stream().map(AssetView::id).toList());
        assertTrue(resolver.asset(v("op"), "A1").isEmpty());
    }

    @Test
    void aLinkedAssetIsVisibleOnlyWhileTheViewerOperatesTheOneItTravelsWith() {
        Evidence link = evidence(EvidenceKind.LINKED, "A1", "T1", null, EvidenceSource.TRIP, NOW, null);
        NetworkResolver operating = resolver(List.of(link,
                evidence(EvidenceKind.OPERATES, "op", "A1", "carrier", EvidenceSource.TRIP, NOW, null)));
        NetworkResolver notOperating = resolver(List.of(link,
                evidence(EvidenceKind.OPERATES, "op", "A1", "carrier", EvidenceSource.TRIP, daysAgo(10), null)));

        assertEquals(AccessReason.LINKED, operating.asset(v("op"), "T1").orElseThrow().access().get(0).reason());
        assertTrue(notOperating.asset(v("op"), "T1").isEmpty());
    }

    @Test
    void anOrganizationWithoutEvidenceSeesNothing() {
        NetworkResolver resolver = resolver(List.of(
                evidence(EvidenceKind.OPERATES, "op", "A1", "carrier", EvidenceSource.TRIP, NOW, null)));
        assertEquals(List.of(), resolver.assets(v("gps")));
        assertEquals(List.of(), resolver.assets(v("unknown")));
    }

    @Test
    void theMostRecentOwnershipWins() {
        NetworkOrganization other = new NetworkOrganization("other", "Other", Set.of(OrgRole.CARRIER), Set.of());
        List<Evidence> evidence = List.of(
                evidence(EvidenceKind.OWNS, "carrier", "A1", null, EvidenceSource.TRIP, daysAgo(3), null),
                evidence(EvidenceKind.OWNS, "other", "A1", null, EvidenceSource.TRIP, daysAgo(1), null),
                evidence(EvidenceKind.OPERATES, "op", "A1", "other", EvidenceSource.TRIP, NOW, null));
        NetworkResolver resolver = new NetworkResolver(new NetworkSnapshot(
                List.of(OPERATOR, CARRIER, other), List.of(new Asset("A1", "Truck", "A1")), evidence), POLICY, NOW);
        assertEquals("other", resolver.asset(v("op"), "A1").orElseThrow().owner().id());
    }

    @Test
    void relationshipsSummarizeTheEvidenceOnSharedAssets() {
        NetworkResolver resolver = resolver(List.of(
                evidence(EvidenceKind.REPORTS, "gps-client", "A1", null, EvidenceSource.SIGNAL, NOW, null),
                evidence(EvidenceKind.OWNS, "carrier", "A1", null, EvidenceSource.TRIP, NOW, null),
                evidence(EvidenceKind.OWNS, "carrier", "A2", null, EvidenceSource.TRIP, NOW, null),
                evidence(EvidenceKind.OPERATES, "op", "A1", "carrier", EvidenceSource.TRIP, daysAgo(20), null),
                evidence(EvidenceKind.OPERATES, "op", "A2", "carrier", EvidenceSource.ACCREDITATION, daysAgo(1),
                        NOW.plus(Duration.ofDays(5)))));

        RelationshipView operation = resolver.relationships(v("op")).get(0);
        assertEquals(RelationshipKind.OPERATION, operation.kind());
        assertEquals(OrgRole.OPERATOR, operation.role());
        assertEquals("carrier", operation.counterpart().id());
        assertEquals(Set.of(EvidenceSource.TRIP, EvidenceSource.ACCREDITATION), operation.sources());
        assertEquals(1, operation.assetCount());
        assertEquals(daysAgo(100), operation.firstSeen());
        assertEquals(NOW.plus(Duration.ofDays(5)), operation.expiresAt());
        assertTrue(operation.active());

        List<RelationshipView> ofCarrier = resolver.relationships(v("carrier"));
        assertEquals(Set.of(RelationshipKind.OPERATION, RelationshipKind.GPS_SERVICE),
                Set.copyOf(ofCarrier.stream().map(RelationshipView::kind).toList()));
        RelationshipView service = resolver.relationships(v("gps")).get(0);
        assertEquals(RelationshipKind.GPS_SERVICE, service.kind());
        assertEquals("carrier", service.counterpart().id());
    }

    @Test
    void aRelationshipWhoseEvidenceExpiredIsInactive() {
        NetworkResolver resolver = resolver(List.of(
                evidence(EvidenceKind.OPERATES, "op", "A1", "carrier", EvidenceSource.TRIP, daysAgo(20), null)));
        RelationshipView operation = resolver.relationships(v("op")).get(0);
        assertFalse(operation.active());
        assertEquals(List.of(), resolver.assets(v("op")));
    }

    private static Evidence trip(EvidenceKind kind, String party, String asset, String counterparty, String trip,
            Instant last) {
        return new Evidence(kind, party, asset, counterparty, EvidenceSource.TRIP, trip, daysAgo(100), last, null);
    }

    @Test
    void aLinkFromAnotherTripDoesNotLeakToTheNextOperator() {
        NetworkOrganization other = new NetworkOrganization("op2", "Other", Set.of(OrgRole.OPERATOR), Set.of());
        List<Evidence> evidence = List.of(
                trip(EvidenceKind.OPERATES, "op", "A1", "carrier", "T1", daysAgo(1)),
                trip(EvidenceKind.LINKED, "A1", "T1", null, "T1", daysAgo(1)),
                trip(EvidenceKind.OPERATES, "op2", "A1", "carrier", "T2", NOW));
        NetworkResolver resolver = new NetworkResolver(new NetworkSnapshot(List.of(OPERATOR, CARRIER, other),
                List.of(new Asset("A1", "Truck", "A1"), new Asset("T1", "Jaula", "T1")), evidence), POLICY, NOW);

        assertTrue(resolver.asset(v("op2"), "T1").isEmpty());
        assertTrue(resolver.asset(v("op"), "T1").isPresent());
    }

    @Test
    void aLinkedAssetIsVisibleOnlyAsLongAsTheOperation() {
        Instant accreditationEnd = NOW.plus(Duration.ofDays(1));
        NetworkResolver resolver = resolver(List.of(
                evidence(EvidenceKind.OPERATES, "op", "A1", "carrier", EvidenceSource.ACCREDITATION, NOW,
                        accreditationEnd),
                evidence(EvidenceKind.LINKED, "A1", "T1", null, EvidenceSource.ACCREDITATION, NOW, null)));
        assertEquals(accreditationEnd, resolver.asset(v("op"), "T1").orElseThrow().access().get(0).expiresAt());
    }

    @Test
    void aLinkedAssetFollowsTheLatestOfTheViewersOperations() {
        NetworkResolver resolver = resolver(List.of(
                evidence(EvidenceKind.OPERATES, "op", "A1", "carrier", EvidenceSource.ACCREDITATION, NOW,
                        NOW.plus(Duration.ofDays(1))),
                evidence(EvidenceKind.OPERATES, "op", "A1", "carrier", EvidenceSource.ACCREDITATION, NOW,
                        NOW.plus(Duration.ofDays(3))),
                evidence(EvidenceKind.LINKED, "A1", "T1", null, EvidenceSource.TRIP, NOW, null)));
        assertEquals(NOW.plus(Duration.ofDays(3)),
                resolver.asset(v("op"), "T1").orElseThrow().access().get(0).expiresAt());
    }

    @Test
    void relationshipsInBothDirectionsStaySeparate() {
        NetworkOrganization both = new NetworkOrganization("b", "B", Set.of(OrgRole.OPERATOR, OrgRole.CARRIER),
                Set.of());
        NetworkOrganization me = new NetworkOrganization("a", "A", Set.of(OrgRole.OPERATOR, OrgRole.CARRIER),
                Set.of());
        List<Evidence> evidence = List.of(
                evidence(EvidenceKind.OPERATES, "a", "B1", "b", EvidenceSource.TRIP, NOW, null),
                evidence(EvidenceKind.OPERATES, "b", "A1", "a", EvidenceSource.TRIP, NOW, null));
        NetworkResolver resolver = new NetworkResolver(new NetworkSnapshot(List.of(me, both),
                List.of(new Asset("A1", "Truck", "A1"), new Asset("B1", "Truck", "B1")), evidence), POLICY, NOW);

        assertEquals(Set.of(OrgRole.OPERATOR, OrgRole.CARRIER),
                Set.copyOf(resolver.relationships(v("a")).stream().map(RelationshipView::role).toList()));
    }

    @Test
    void theCarrierAnOperationNamesSeesTheAssetAsOwner() {
        NetworkResolver resolver = resolver(List.of(
                evidence(EvidenceKind.OPERATES, "op", "A1", "carrier", EvidenceSource.TRIP, NOW, null)));
        AssetView seen = resolver.asset(v("carrier"), "A1").orElseThrow();
        assertEquals(AccessReason.OWNER, seen.access().get(0).reason());
        assertEquals("carrier", seen.owner().id());
    }

    @Test
    void gpsServiceIsCreditedToTheOwnerOfTheTime() {
        NetworkOrganization buyer = new NetworkOrganization("buyer", "Buyer", Set.of(OrgRole.CARRIER), Set.of());
        List<Evidence> evidence = List.of(
                evidence(EvidenceKind.REPORTS, "gps-client", "A1", null, EvidenceSource.SIGNAL, NOW, null),
                new Evidence(EvidenceKind.OWNS, "carrier", "A1", null, EvidenceSource.TRIP, "t", daysAgo(100),
                        daysAgo(40), null),
                new Evidence(EvidenceKind.OWNS, "buyer", "A1", null, EvidenceSource.TRIP, "t", daysAgo(10), NOW,
                        null));
        NetworkResolver resolver = new NetworkResolver(new NetworkSnapshot(List.of(PROVIDER, CARRIER, buyer),
                List.of(new Asset("A1", "Truck", "A1")), evidence), POLICY, NOW);

        RelationshipView former = resolver.relationships(v("carrier")).get(0);
        assertEquals(daysAgo(40).plus(Duration.ofDays(7)), former.expiresAt());
        assertFalse(former.active());
        RelationshipView current = resolver.relationships(v("buyer")).get(0);
        assertEquals(daysAgo(10), current.firstSeen());
        assertTrue(current.active());
    }

    @Test
    void aParentSeesWhatItsChildrensCredentialsReport() {
        NetworkResolver resolver = resolver(List.of(
                evidence(EvidenceKind.REPORTS, "child-client", "A1", null, EvidenceSource.SIGNAL, NOW, null)));
        assertEquals(List.of(), resolver.assets(v("parent")));
        assertEquals(List.of("A1"), resolver.assets(new Viewer("parent", Set.of("child-client"))).stream()
                .map(AssetView::id).toList());
    }

    @Test
    void anOrganizationWithoutANameDoesNotBreakTheList() {
        NetworkOrganization unnamed = new NetworkOrganization("x", null, Set.of(OrgRole.CARRIER), Set.of());
        List<Evidence> evidence = List.of(
                evidence(EvidenceKind.OPERATES, "op", "A1", "x", EvidenceSource.TRIP, NOW, null),
                evidence(EvidenceKind.OPERATES, "op", "A2", "carrier", EvidenceSource.TRIP, NOW, null));
        NetworkResolver resolver = new NetworkResolver(new NetworkSnapshot(List.of(OPERATOR, CARRIER, unnamed),
                List.of(new Asset("A1", "Truck", "A1"), new Asset("A2", "Truck", "A2")), evidence), POLICY, NOW);
        assertEquals(List.of("carrier", "x"),
                resolver.relationships(v("op")).stream().map(r -> r.counterpart().id()).toList());
    }

    @Test
    void anAssetWithoutOwnershipEvidenceHasNoOwner() {
        NetworkResolver resolver = resolver(List.of(
                evidence(EvidenceKind.REPORTS, "gps-client", "A1", null, EvidenceSource.SIGNAL, NOW, null)));
        assertNull(resolver.asset(v("gps"), "A1").orElseThrow().owner());
        assertEquals(List.of(), resolver.relationships(v("gps")));
    }
}
