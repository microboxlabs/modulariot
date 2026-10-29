package com.microboxlabs.miot.trips.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.domain.Location.Placement;
import com.microboxlabs.miot.trips.dto.FeedServiceRequest;
import com.microboxlabs.miot.trips.dto.FeedServiceRequest.Site;
import java.util.List;
import org.junit.jupiter.api.Test;

class FeedSitesTest {

    private static final Site LARCO = new Site("Av. Larco 101", "PE", "150122", null, null, null, null);

    private static Location location(Integer geofenceId, Placement placement) {
        return new Location("id-1", "client-a", "CD-01", "zone", "CD-01", null, geofenceId, null, null, null, null,
                placement);
    }

    private static Placement placement(String address, String status) {
        return new Placement(address, "PE", "150122", null, null, null, null, null, status, null);
    }

    @Test
    void aLocationNeverTriedIsLocated() {
        assertTrue(FeedSites.due(location(null, Placement.NONE), LARCO));
    }

    @Test
    void aResolvedRejectedOrLinkedLocationIsLeftAsItIs() {
        assertFalse(FeedSites.due(location(null, placement("Av. Larco 101", Location.RESOLVED)), LARCO));
        assertFalse(FeedSites.due(location(null, placement("Av. Larco 101", Location.REJECTED)), LARCO));
        assertFalse(FeedSites.due(location(42, Placement.NONE), LARCO));
    }

    @Test
    void aLocationInReviewIsTriedAgainOnlyWithADifferentSite() {
        Location inReview = location(null, placement("Av. Larco 101", Location.NEEDS_REVIEW));

        assertFalse(FeedSites.due(inReview, LARCO));
        assertTrue(FeedSites.due(inReview, new Site("Av. Larco 345", "PE", "150122", null, null, null, null)));
        assertTrue(FeedSites.due(inReview, new Site("Av. Larco 101", "PE", "150122", null, "57X8+QJ", null, null)));
        assertTrue(FeedSites.due(inReview, new Site("Av. Larco 101", "PE", "150122", null, null, -12.12, -77.03)));
    }

    @Test
    void aServiceWithoutSitesLocatesNothing() {
        FeedSites sites = new FeedSites(null, null);
        FeedServiceRequest desired = new FeedServiceRequest("service", "ref", "CD-01", "CD-02", null, null, null,
                null);

        assertEquals(List.of(), sites.locate("org-a", "client-a", "feed:test", desired));
        assertEquals(List.of(), sites.locate("org-a", "client-a", "feed:test", null));
    }
}
