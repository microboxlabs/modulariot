package com.microboxlabs.miot.core.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;

import com.microboxlabs.miot.core.auth.PlatformTestProfile;
import com.microboxlabs.miot.core.auth.TestTokenFactory;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(PlatformTestProfile.class)
class OrgAccessPlatformTest {

    @Test
    void aPlatformOwnerHasAccessWithoutAnOrganizationTeamLookup() {
        given().header("Authorization", "Bearer " + TestTokenFactory.signWebToken(PlatformTestProfile.OWNER_EMAIL))
                .when().get("/api/v1/orgs/_platform/me/access")
                .then().statusCode(200)
                .body("organization", is("_platform"))
                .body("teams", empty());
    }
}
