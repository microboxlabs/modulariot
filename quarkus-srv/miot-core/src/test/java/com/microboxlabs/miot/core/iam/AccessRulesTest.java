package com.microboxlabs.miot.core.iam;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class AccessRulesTest {

    /** A module with a legacy default, as the control tower declares. */
    static final AccessCatalog TOWER = new AccessCatalog() {
        @Override
        public List<PermissionDef> permissions() {
            return List.of(PermissionDef.of("tower:view", "Ver", "View"),
                    PermissionDef.of("tower:treat", "Tratar", "Treat"),
                    PermissionDef.of("tower:publish", "Publicar", "Publish"));
        }

        @Override
        public List<RoleDef> roles() {
            return List.of(RoleDef.of("TOWER_VIEWER", "tower", "Lector", "Viewer", Set.of("tower:view")),
                    RoleDef.of("TOWER_OPERATOR", "tower", "Operador", "Operator", Set.of("tower:view", "tower:treat"))
                            .asLegacyDefault());
        }
    };

    static final AccessRegistry REGISTRY = new AccessRegistry(List.of(new CoreAccessCatalog(), TOWER));
    static final Caller ANA = Caller.user("Ana@Example.com");

    private static Access resolve(Caller caller, AccessRules.Facts facts) {
        return AccessRules.resolve(1L, "acme", caller, facts, REGISTRY);
    }

    private static AccessRules.Facts nativeFacts(BaseRole membership, String... roles) {
        return new AccessRules.Facts(membership, false, Set.of(roles));
    }

    @Test
    void aUserNeedsAMembership() {
        assertFalse(resolve(ANA, nativeFacts(null, "TOWER_VIEWER")).member());
        Access member = resolve(ANA, nativeFacts(BaseRole.MEMBER));
        assertEquals(BaseRole.MEMBER, member.baseRole());
        assertEquals(Set.of(CoreAccessCatalog.ORG_READ, CoreAccessCatalog.MEMBERS_READ), member.permissions());
    }

    @Test
    void aMemberGetsOnlyWhatTheirRolesGive() {
        Access viewer = resolve(ANA, nativeFacts(BaseRole.MEMBER, "TOWER_VIEWER"));
        assertTrue(viewer.can("tower:view"));
        assertFalse(viewer.can("tower:treat"));
        assertEquals(Set.of("TOWER_VIEWER"), viewer.roles());
        assertEquals(Set.of(), resolve(ANA, nativeFacts(BaseRole.MEMBER)).roles(), "no legacy default for a user");
    }

    @Test
    void ownersAndAdminsGetEveryPermissionButTheExplicitOnes() {
        Access owner = resolve(ANA, nativeFacts(BaseRole.OWNER));
        assertTrue(owner.can("tower:publish"));
        assertTrue(owner.can(CoreAccessCatalog.OWNERS_MANAGE));
        assertFalse(owner.can(CoreAccessCatalog.CONTENT_AUTO_APPROVE));

        Access admin = resolve(ANA, nativeFacts(BaseRole.ADMIN));
        assertTrue(admin.can("tower:publish"));
        assertTrue(admin.can(CoreAccessCatalog.MEMBERS_INVITE));
        assertFalse(admin.can(CoreAccessCatalog.OWNERS_MANAGE));
        assertFalse(admin.can(CoreAccessCatalog.ORG_DELETE));
    }

    @Test
    void aPlatformOwnerIsOwnerOfEveryOrganization() {
        AccessRules.Facts noMembership = new AccessRules.Facts(null, false, Set.of(), true);
        assertEquals(BaseRole.OWNER, resolve(ANA, noMembership).baseRole());
        assertTrue(resolve(ANA, noMembership).can(CoreAccessCatalog.OWNERS_MANAGE));
    }

    @Test
    void platformOwnershipGivesAClientNothing() {
        AccessRules.Facts facts = new AccessRules.Facts(null, false, Set.of(), true);
        assertFalse(resolve(Caller.client("other-client"), facts).member());
    }

    @Test
    void theOrganizationsOwnClientIsAMemberWithTheLegacyDefaults() {
        Caller client = Caller.client("client-acme");
        Access own = resolve(client, new AccessRules.Facts(null, true, Set.of()));
        assertEquals(BaseRole.MEMBER, own.baseRole());
        assertTrue(own.can("tower:treat"));
        assertFalse(resolve(client, new AccessRules.Facts(null, false, Set.of())).member());
        Access viewer = resolve(client, new AccessRules.Facts(null, true, Set.of("TOWER_VIEWER")));
        assertEquals(Set.of("TOWER_VIEWER"), viewer.roles(), "an explicit module role replaces the default");
    }

    @Test
    void aCallerWithoutIdentityIsNobody() {
        assertNull(AccessRules.baseRole(new Caller(null, null), nativeFacts(BaseRole.OWNER)));
    }

    @Test
    void aCallerIsAUserWhenTheTokenHasAnEmail() {
        Caller both = new Caller(" Ana@Example.com ", "client-acme");
        assertTrue(both.isUser());
        assertFalse(both.isClient());
        assertEquals("ana@example.com", both.email());
    }
}
