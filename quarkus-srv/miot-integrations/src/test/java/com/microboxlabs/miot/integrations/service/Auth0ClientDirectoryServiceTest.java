package com.microboxlabs.miot.integrations.service;

import static com.microboxlabs.miot.integrations.service.Auth0ClientDirectoryService.addOrganization;
import static com.microboxlabs.miot.integrations.service.Auth0ClientDirectoryService.filterAndCap;
import static com.microboxlabs.miot.integrations.service.Auth0ClientDirectoryService.merge;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.model.Organization;
import com.microboxlabs.miot.integrations.dto.Auth0ClientSummary;
import com.microboxlabs.miot.integrations.dto.Auth0ClientSummary.Source;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * The entitlement and merge rules, exercised without a database: what an
 * organization contributes, and how an advisory directory row is allowed to
 * interact with an authoritative one.
 */
class Auth0ClientDirectoryServiceTest {

    private static Organization org(String slug, String name, String clientId) {
        Organization organization = new Organization();
        organization.id = 1L;
        organization.slug = slug;
        organization.name = name;
        organization.tenantClientId = clientId;
        organization.active = true;
        return organization;
    }

    private static Auth0ClientSummary directory(String clientId, String name) {
        return new Auth0ClientSummary(clientId, name, null, true, Source.DIRECTORY);
    }

    @Test
    void anOrganizationContributesItsTenantClientId() {
        List<Auth0ClientSummary> out = new ArrayList<>();

        addOrganization(out, org("mintral", "Mintral", "clientMintral"), null);

        assertEquals(1, out.size());
        assertEquals("clientMintral", out.get(0).clientId());
        assertEquals("Mintral", out.get(0).name());
        assertEquals(Source.ORGANIZATION, out.get(0).source());
    }

    @Test
    void aChildIsLabelledWithItsParent() {
        List<Auth0ClientSummary> out = new ArrayList<>();
        Organization parent = org("mintral", "Mintral", "clientMintral");

        addOrganization(out, org("mintral-norte", "Mintral Norte", "clientNorte"), parent);

        // The slug pair is what disambiguates two children with similar names.
        assertEquals("mintral-norte · mintral", out.get(0).description());
    }

    @Test
    void displayNameWinsOverNameWhenSet() {
        List<Auth0ClientSummary> out = new ArrayList<>();
        Organization organization = org("mintral", "MINTRAL SPA", "clientMintral");
        organization.displayName = "Mintral";

        addOrganization(out, organization, null);

        assertEquals("Mintral", out.get(0).name());
    }

    @Test
    void anOrganizationWithNoClientIdContributesNothing() {
        // Offering a row the operator can select but not authenticate as is
        // worse than leaving it out — the credential would fail its first call.
        List<Auth0ClientSummary> out = new ArrayList<>();

        addOrganization(out, org("empty", "No client", null), null);
        addOrganization(out, org("blank", "Blank client", "   "), null);

        assertTrue(out.isEmpty());
    }

    @Test
    void theOrganizationRowWinsWhenTheDirectoryNamesTheSameClient() {
        List<Auth0ClientSummary> owned = new ArrayList<>();
        addOrganization(owned, org("mintral", "Mintral", "clientMintral"), null);
        Auth0ClientSummary shadow = directory("clientMintral", "raw-auth0-app-name");

        List<Auth0ClientSummary> merged = merge(owned, List.of(shadow));

        assertEquals(1, merged.size());
        assertSame(owned.get(0), merged.get(0));
        assertEquals(Source.ORGANIZATION, merged.get(0).source());
    }

    @Test
    void directoryOnlyClientsAreAdditive() {
        List<Auth0ClientSummary> owned = new ArrayList<>();
        addOrganization(owned, org("mintral", "Mintral", "clientMintral"), null);

        List<Auth0ClientSummary> merged =
                merge(owned, List.of(directory("clientFresh", "Newly created app")));

        assertEquals(2, merged.size());
        // The org's own client stays first: it is the one being looked for.
        assertEquals("clientMintral", merged.get(0).clientId());
        assertEquals("clientFresh", merged.get(1).clientId());
    }

    @Test
    void filterMatchesNameAndClientIdCaseInsensitively() {
        List<Auth0ClientSummary> all =
                List.of(directory("abc123", "Fleet ingest"), directory("xyz789", "Reporting"));

        assertEquals(1, filterAndCap(all, "fleet", 10).size());
        assertEquals(1, filterAndCap(all, "XYZ", 10).size());
        assertEquals(2, filterAndCap(all, "", 10).size());
        assertTrue(filterAndCap(all, "nothing", 10).isEmpty());
    }

    @Test
    void theLimitCapsTheResult() {
        List<Auth0ClientSummary> all = List.of(
                directory("a", "One"), directory("b", "Two"), directory("c", "Three"));

        assertEquals(2, filterAndCap(all, "", 2).size());
    }
}
