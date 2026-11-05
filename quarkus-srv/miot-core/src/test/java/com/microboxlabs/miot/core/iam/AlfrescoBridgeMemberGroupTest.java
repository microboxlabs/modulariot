package com.microboxlabs.miot.core.iam;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class AlfrescoBridgeMemberGroupTest {

    @Test
    void aSiteGroupProjectsToItsConsumerGroup() {
        assertEquals("GROUP_site_mintral_SiteConsumer", AlfrescoBridge.memberGroupOf("GROUP_site_mintral"));
    }

    @Test
    void aSiteRoleGroupOrAPlainGroupIsUsedAsIs() {
        assertEquals("GROUP_site_mintral_SiteCollaborator",
                AlfrescoBridge.memberGroupOf("GROUP_site_mintral_SiteCollaborator"));
        assertEquals("GROUP_TRAZA", AlfrescoBridge.memberGroupOf("GROUP_TRAZA"));
        assertNull(AlfrescoBridge.memberGroupOf(null));
    }
}
