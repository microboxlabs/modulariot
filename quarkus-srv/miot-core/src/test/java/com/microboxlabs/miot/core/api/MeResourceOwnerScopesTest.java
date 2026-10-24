package com.microboxlabs.miot.core.api;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.core.api.dto.OrganizationScopeDto;
import com.microboxlabs.miot.core.model.Organization;
import com.microboxlabs.miot.core.model.OrganizationModule;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class MeResourceOwnerScopesTest {

    private static Organization org(long id, String slug, String displayName, String taxId, Organization parent) {
        Organization org = new Organization();
        org.id = id;
        org.slug = slug;
        org.name = slug.toUpperCase();
        org.displayName = displayName;
        org.taxId = taxId;
        org.parent = parent;
        return org;
    }

    @Test
    void everyOrganizationIsOwnedWithItsModulesAndTaxIds() {
        Organization gama = org(1, "gama", "Gama", null, null);
        Organization north = org(2, "gama-north", null, "76.111.111-1", gama);
        Organization south = org(3, "gama-south", "Sur", "76.222.222-2", gama);
        Organization noTax = org(4, "gama-west", "Oeste", null, gama);
        Organization demo = org(5, "demo", "Demo", null, null);
        List<OrganizationModule> modules = List.of(
                new OrganizationModule(1L, "DASHBOARDS", true),
                new OrganizationModule(1L, "FLEET_MANAGEMENT", true),
                new OrganizationModule(3L, "DASHBOARDS", true));

        List<OrganizationScopeDto> listed = MeResource.ownerScopes(List.of(gama, north, south, noTax, demo), modules);
        Map<String, OrganizationScopeDto> scopes = listed.stream()
                .collect(Collectors.toMap(OrganizationScopeDto::slug, Function.identity()));

        assertEquals(new OrganizationScopeDto(1L, "gama", "Gama", null, "OWNER", true,
                List.of("76.111.111-1", "76.222.222-2"), List.of("DASHBOARDS", "FLEET_MANAGEMENT")), scopes.get("gama"));
        assertEquals(new OrganizationScopeDto(2L, "gama-north", "GAMA-NORTH", "76.111.111-1", "OWNER", false,
                List.of("76.111.111-1"), List.of()), scopes.get("gama-north"));
        assertEquals(List.of("DASHBOARDS"), scopes.get("gama-south").modules());
        assertEquals(List.of(), scopes.get("gama-west").effectiveTaxIds());
        assertEquals(new OrganizationScopeDto(5L, "demo", "Demo", null, "OWNER", true, List.of(), List.of()),
                scopes.get("demo"));
        assertEquals(6, scopes.size());
        assertEquals(new OrganizationScopeDto(-1L, "_platform", "Plataforma", null, "PLATFORM_OWNER", false,
                List.of(), List.of()), listed.get(listed.size() - 1));
    }
}
