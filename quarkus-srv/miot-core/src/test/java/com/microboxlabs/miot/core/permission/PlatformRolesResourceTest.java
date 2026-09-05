package com.microboxlabs.miot.core.permission;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasItem;

import com.microboxlabs.miot.core.auth.PlatformTestProfile;
import com.microboxlabs.miot.core.auth.TestTokenFactory;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.restassured.specification.RequestSpecification;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Locale;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/**
 * End-to-end coverage for platform roles: that a grant in the table authorizes
 * the same writes the configured allowlist does, which is the whole point of
 * moving the role into the database.
 */
@QuarkusTest
@TestProfile(PlatformTestProfile.class)
class PlatformRolesResourceTest {

    private static final String ROLE_PATH = "/api/v1/platform/roles/PLATFORM_OWNER";
    private static final String LOGO_DATA_URL = "data:image/svg+xml;base64,"
            + Base64.getEncoder().encodeToString(
                    "<svg xmlns=\"http://www.w3.org/2000/svg\"/>".getBytes(StandardCharsets.UTF_8));

    private static String tokenFor(String email) {
        return TestTokenFactory.signWebToken(email);
    }

    private static RequestSpecification as(String email) {
        return given().header("Authorization", "Bearer " + tokenFor(email))
                .contentType("application/json");
    }

    private static void setAssignees(String json) {
        as(PlatformTestProfile.OWNER_EMAIL)
                .body("{\"assigneeIds\":" + json + "}")
                .when().put(ROLE_PATH)
                .then().statusCode(200);
    }

    /** The profile is shared, so no test may leave a grant behind. */
    @AfterEach
    void clearGrants() {
        setAssignees("[]");
    }

    @Test
    void heldRolesAreReadableByAnyAuthenticatedCallerAndEmptyForAStranger() {
        as(PlatformTestProfile.OWNER_EMAIL).when().get("/api/v1/platform/roles/me")
                .then().statusCode(200)
                .body("roleCodes", contains("PLATFORM_OWNER"));

        as(PlatformTestProfile.NON_OWNER_EMAIL).when().get("/api/v1/platform/roles/me")
                .then().statusCode(200)
                .body("roleCodes", empty());
    }

    @Test
    void theLiteralMePathIsNotCapturedByTheRoleCodeTemplate() {
        given().when().get("/api/v1/platform/roles/me").then().statusCode(401);
    }

    @Test
    void roleAdministrationIsClosedToUnauthenticatedAndNonOwnerCallers() {
        given().when().get(ROLE_PATH).then().statusCode(401);
        as(PlatformTestProfile.NON_OWNER_EMAIL).when().get(ROLE_PATH).then().statusCode(403);
        as(PlatformTestProfile.NON_OWNER_EMAIL)
                .body("{\"assigneeIds\":[\"" + PlatformTestProfile.NON_OWNER_EMAIL + "\"]}")
                .when().put(ROLE_PATH).then().statusCode(403);
    }

    @Test
    void theConfiguredOwnerIsReportedSeparatelyFromDatabaseGrants() {
        as(PlatformTestProfile.OWNER_EMAIL).when().get(ROLE_PATH)
                .then().statusCode(200)
                .body("assigneeIds", empty())
                .body("bootstrapAssigneeIds", hasItem(PlatformTestProfile.OWNER_EMAIL));
    }

    @Test
    void aNonOwnerIsForbiddenRatherThanToldWhetherARoleCodeExists() {
        as(PlatformTestProfile.NON_OWNER_EMAIL)
                .when().get("/api/v1/platform/roles/NO_SUCH_ROLE")
                .then().statusCode(403);
    }

    @Test
    void aTokenWithoutAnEmailClaimHoldsNoRoleRatherThanBeingRefused() {
        given().header("Authorization",
                        "Bearer " + TestTokenFactory.signWebTokenWithoutEmail())
                .when().get("/api/v1/platform/roles/me")
                .then().statusCode(200)
                .body("roleCodes", empty());
    }

    @Test
    void anAssigneeLongerThanTheColumnIsRejectedRatherThanFailingInTheDatabase() {
        as(PlatformTestProfile.OWNER_EMAIL)
                .body("{\"assigneeIds\":[\"" + "a".repeat(250) + "@test.example\"]}")
                .when().put(ROLE_PATH)
                .then().statusCode(400);
    }

    @Test
    void unknownRoleCodesAreRejected() {
        as(PlatformTestProfile.OWNER_EMAIL)
                .when().get("/api/v1/platform/roles/ORGANIZATION_OWNER")
                .then().statusCode(400);
    }

    @Test
    void aGrantedOwnerCanAdministerBrandingWithoutBeingInTheConfiguredList() {
        as(PlatformTestProfile.GRANTED_EMAIL)
                .body("{\"logoDataUrl\":\"" + LOGO_DATA_URL + "\"}")
                .when().put("/api/v1/platform/branding/domains/granted.test")
                .then().statusCode(403);

        setAssignees("[\"" + PlatformTestProfile.GRANTED_EMAIL + "\"]");

        as(PlatformTestProfile.GRANTED_EMAIL).when().get("/api/v1/platform/roles/me")
                .then().statusCode(200)
                .body("roleCodes", contains("PLATFORM_OWNER"));

        as(PlatformTestProfile.GRANTED_EMAIL)
                .body("{\"logoDataUrl\":\"" + LOGO_DATA_URL + "\"}")
                .when().put("/api/v1/platform/branding/domains/granted.test")
                .then().statusCode(200);

        as(PlatformTestProfile.GRANTED_EMAIL)
                .when().delete("/api/v1/platform/branding/domains/granted.test")
                .then().statusCode(204);
    }

    @Test
    void grantsAreStoredLowerCasedSoTheyMatchTheTokenClaim() {
        setAssignees("[\"" + PlatformTestProfile.GRANTED_EMAIL.toUpperCase(Locale.ROOT) + "\"]");

        as(PlatformTestProfile.OWNER_EMAIL).when().get(ROLE_PATH)
                .then().statusCode(200)
                .body("assigneeIds", contains(PlatformTestProfile.GRANTED_EMAIL));

        as(PlatformTestProfile.GRANTED_EMAIL).when().get("/api/v1/platform/roles/me")
                .then().statusCode(200)
                .body("roleCodes", contains("PLATFORM_OWNER"));
    }

    @Test
    void aGrantReplacesTheWholeSetRatherThanAddingToIt() {
        setAssignees("[\"" + PlatformTestProfile.GRANTED_EMAIL + "\"]");
        setAssignees("[\"" + PlatformTestProfile.OWNER_EMAIL + "\"]");

        as(PlatformTestProfile.OWNER_EMAIL).when().get(ROLE_PATH)
                .then().statusCode(200)
                .body("assigneeIds", contains(PlatformTestProfile.OWNER_EMAIL));
    }
}
