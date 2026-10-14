package com.microboxlabs.miot.core.iam;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.security.SecureRandom;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class TeamRulesTest {

    private static final AccessRegistry REGISTRY = AccessRulesTest.REGISTRY;

    private static Access as(BaseRole base, String... roles) {
        return AccessRules.resolve(1L, "acme", Caller.user("actor@example.com"),
                new AccessRules.Facts(true, base, false, false, false, Set.of(roles), null), REGISTRY);
    }

    @Test
    void onlyOwnersMakeOrUnmakeOwners() {
        Access admin = as(BaseRole.ADMIN);
        Access owner = as(BaseRole.OWNER);
        assertThrows(SecurityException.class,
                () -> TeamRules.checkBaseRoleChange(admin, BaseRole.MEMBER, BaseRole.OWNER, 2));
        assertThrows(SecurityException.class,
                () -> TeamRules.checkBaseRoleChange(admin, BaseRole.OWNER, BaseRole.MEMBER, 2));
        assertDoesNotThrow(() -> TeamRules.checkBaseRoleChange(admin, BaseRole.MEMBER, BaseRole.ADMIN, 1));
        assertDoesNotThrow(() -> TeamRules.checkBaseRoleChange(owner, BaseRole.MEMBER, BaseRole.OWNER, 1));
    }

    @Test
    void theLastOwnerStays() {
        Access owner = as(BaseRole.OWNER);
        Access admin = as(BaseRole.ADMIN);
        assertThrows(IllegalStateException.class,
                () -> TeamRules.checkBaseRoleChange(owner, BaseRole.OWNER, BaseRole.ADMIN, 1));
        assertThrows(IllegalStateException.class, () -> TeamRules.checkRemoval(owner, BaseRole.OWNER, 1));
        assertDoesNotThrow(() -> TeamRules.checkRemoval(owner, BaseRole.OWNER, 2));
        assertDoesNotThrow(() -> TeamRules.checkRemoval(admin, BaseRole.MEMBER, 1));
    }

    @Test
    void nobodyGrantsWhatTheyCannotDo() {
        Access viewer = as(BaseRole.MEMBER, "TOWER_VIEWER");
        Access admin = as(BaseRole.ADMIN);
        List<String> operator = List.of("TOWER_OPERATOR");
        assertThrows(SecurityException.class, () -> TeamRules.checkGrant(viewer, operator, REGISTRY));
        assertDoesNotThrow(() -> TeamRules.checkGrant(viewer, List.of("TOWER_VIEWER"), REGISTRY));
        assertDoesNotThrow(() -> TeamRules.checkGrant(admin, operator, REGISTRY));
    }

    @Test
    void explicitOnlyPermissionsAreGrantedWithoutBeingHeld() {
        Access owner = as(BaseRole.OWNER);
        List<String> autoApprover = List.of(CoreAccessCatalog.CONTENT_REVIEW_AUTO_APPROVER);
        assertDoesNotThrow(() -> TeamRules.checkGrant(owner, autoApprover, REGISTRY));
    }

    @Test
    void anUnknownRoleIsBadInput() {
        Access owner = as(BaseRole.OWNER);
        List<String> unknown = List.of("NOPE");
        assertThrows(IllegalArgumentException.class, () -> TeamRules.checkGrant(owner, unknown, REGISTRY));
    }

    @Test
    void onlyOwnersInviteOwners() {
        Access admin = as(BaseRole.ADMIN);
        Set<String> none = Set.of();
        assertThrows(SecurityException.class, () -> TeamRules.checkInvite(admin, BaseRole.OWNER, none, REGISTRY));
        assertDoesNotThrow(() -> TeamRules.checkInvite(admin, BaseRole.ADMIN, none, REGISTRY));
    }

    @Test
    void tokensAreRandomAndOnlyTheirHashIsKept() {
        SecureRandom random = new SecureRandom();
        String a = TeamService.newToken(random);
        String b = TeamService.newToken(random);
        org.junit.jupiter.api.Assertions.assertNotEquals(a, b);
        org.junit.jupiter.api.Assertions.assertEquals(64, TeamService.hash(a).length());
        org.junit.jupiter.api.Assertions.assertEquals(TeamService.hash(a), TeamService.hash(a));
    }

    @Test
    void anEmailHasOneAtAndADottedDomain() {
        org.junit.jupiter.api.Assertions.assertTrue(TeamService.isEmail("ana@example.com"));
        org.junit.jupiter.api.Assertions.assertTrue(TeamService.isEmail("a@b.c"));
        org.junit.jupiter.api.Assertions.assertFalse(TeamService.isEmail("ana@example"));
        org.junit.jupiter.api.Assertions.assertFalse(TeamService.isEmail("@example.com"));
        org.junit.jupiter.api.Assertions.assertFalse(TeamService.isEmail("a@@example.com"));
        org.junit.jupiter.api.Assertions.assertFalse(TeamService.isEmail("a b@example.com"));
        org.junit.jupiter.api.Assertions.assertFalse(TeamService.isEmail("a@.com"));
        org.junit.jupiter.api.Assertions.assertFalse(TeamService.isEmail("a@example."));
        org.junit.jupiter.api.Assertions.assertFalse(TeamService.isEmail(null));
    }

    @Test
    void invitationsLastBetweenOneAndNinetyDays() {
        assertThrows(IllegalArgumentException.class, () -> TeamService.ttl(0));
        assertThrows(IllegalArgumentException.class, () -> TeamService.ttl(91));
        org.junit.jupiter.api.Assertions.assertEquals(TeamService.DEFAULT_INVITATION_TTL, TeamService.ttl(null));
    }
}
