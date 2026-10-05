package com.microboxlabs.miot.core.iam;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

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
        assertThrows(SecurityException.class,
                () -> TeamRules.checkBaseRoleChange(as(BaseRole.ADMIN), BaseRole.MEMBER, BaseRole.OWNER, 2));
        assertThrows(SecurityException.class,
                () -> TeamRules.checkBaseRoleChange(as(BaseRole.ADMIN), BaseRole.OWNER, BaseRole.MEMBER, 2));
        assertDoesNotThrow(
                () -> TeamRules.checkBaseRoleChange(as(BaseRole.ADMIN), BaseRole.MEMBER, BaseRole.ADMIN, 1));
        assertDoesNotThrow(
                () -> TeamRules.checkBaseRoleChange(as(BaseRole.OWNER), BaseRole.MEMBER, BaseRole.OWNER, 1));
    }

    @Test
    void theLastOwnerStays() {
        assertThrows(IllegalStateException.class,
                () -> TeamRules.checkBaseRoleChange(as(BaseRole.OWNER), BaseRole.OWNER, BaseRole.ADMIN, 1));
        assertThrows(IllegalStateException.class,
                () -> TeamRules.checkRemoval(as(BaseRole.OWNER), BaseRole.OWNER, 1));
        assertDoesNotThrow(() -> TeamRules.checkRemoval(as(BaseRole.OWNER), BaseRole.OWNER, 2));
        assertDoesNotThrow(() -> TeamRules.checkRemoval(as(BaseRole.ADMIN), BaseRole.MEMBER, 1));
    }

    @Test
    void nobodyGrantsWhatTheyCannotDo() {
        Access viewer = as(BaseRole.MEMBER, "TOWER_VIEWER");
        assertThrows(SecurityException.class,
                () -> TeamRules.checkGrant(viewer, List.of("TOWER_OPERATOR"), REGISTRY));
        assertDoesNotThrow(() -> TeamRules.checkGrant(viewer, List.of("TOWER_VIEWER"), REGISTRY));
        assertDoesNotThrow(() -> TeamRules.checkGrant(as(BaseRole.ADMIN), List.of("TOWER_OPERATOR"), REGISTRY));
    }

    @Test
    void explicitOnlyPermissionsAreGrantedWithoutBeingHeld() {
        assertDoesNotThrow(() -> TeamRules.checkGrant(as(BaseRole.OWNER),
                List.of(CoreAccessCatalog.CONTENT_REVIEW_AUTO_APPROVER), REGISTRY));
    }

    @Test
    void anUnknownRoleIsBadInput() {
        assertThrows(IllegalArgumentException.class,
                () -> TeamRules.checkGrant(as(BaseRole.OWNER), List.of("NOPE"), REGISTRY));
    }

    @Test
    void onlyOwnersInviteOwners() {
        assertThrows(SecurityException.class,
                () -> TeamRules.checkInvite(as(BaseRole.ADMIN), BaseRole.OWNER, Set.of(), REGISTRY));
        assertDoesNotThrow(() -> TeamRules.checkInvite(as(BaseRole.ADMIN), BaseRole.ADMIN, Set.of(), REGISTRY));
    }

    @Test
    void tokensAreRandomAndOnlyTheirHashIsKept() {
        String a = TeamService.newToken();
        String b = TeamService.newToken();
        assertThrows(AssertionError.class, () -> org.junit.jupiter.api.Assertions.assertEquals(a, b));
        org.junit.jupiter.api.Assertions.assertEquals(64, TeamService.hash(a).length());
        org.junit.jupiter.api.Assertions.assertEquals(TeamService.hash(a), TeamService.hash(a));
    }

    @Test
    void invitationsLastBetweenOneAndNinetyDays() {
        assertThrows(IllegalArgumentException.class, () -> TeamService.ttl(0));
        assertThrows(IllegalArgumentException.class, () -> TeamService.ttl(91));
        org.junit.jupiter.api.Assertions.assertEquals(TeamService.DEFAULT_INVITATION_TTL, TeamService.ttl(null));
    }
}
