package com.microboxlabs.miot.core.branding;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.microboxlabs.miot.core.auth.PlatformTestProfile;
import com.microboxlabs.miot.core.auth.TestTokenFactory;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.restassured.response.Response;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.junit.jupiter.api.Test;

/**
 * End-to-end coverage for the branding endpoints: the public permit, the
 * {@code bytea} round trip, the response headers and the conditional GET, none
 * of which the validator unit tests can reach.
 */
@QuarkusTest
@TestProfile(PlatformTestProfile.class)
class BrandingResourceTest {

    private static final byte[] LOGO =
            "<svg xmlns=\"http://www.w3.org/2000/svg\"/>".getBytes(StandardCharsets.UTF_8);
    private static final String LOGO_DATA_URL =
            "data:image/svg+xml;base64," + Base64.getEncoder().encodeToString(LOGO);

    /** Deliberately different bytes, so a mixed-up variant shows as wrong content. */
    private static final byte[] DARK_LOGO =
            "<svg id=\"dark\"/>".getBytes(StandardCharsets.UTF_8);
    private static final String DARK_LOGO_DATA_URL =
            "data:image/svg+xml;base64," + Base64.getEncoder().encodeToString(DARK_LOGO);

    private static String ownerToken() {
        return TestTokenFactory.signWebToken(PlatformTestProfile.OWNER_EMAIL);
    }

    private static void putBranding(String domain, String body) {
        given().header("Authorization", "Bearer " + ownerToken())
                .contentType("application/json")
                .body(body)
                .when().put("/api/v1/platform/branding/domains/" + domain)
                .then().statusCode(200);
    }

    private static String requestBody(String homeUrl) {
        String home = homeUrl == null ? "null" : "\"" + homeUrl + "\"";
        return "{\"logoDataUrl\":\"" + LOGO_DATA_URL + "\",\"homeUrl\":" + home + "}";
    }

    /** Both grounds in one body, the way the settings form sends them. */
    private static String requestBodyWithDarkLogo() {
        return "{\"logoDataUrl\":\"" + LOGO_DATA_URL
                + "\",\"logoDarkDataUrl\":\"" + DARK_LOGO_DATA_URL + "\"}";
    }

    @Test
    void metadataIsReadableWithoutAuthenticationAndReportsAnUnconfiguredDomain() {
        given().when().get("/branding/nothing-here.test")
                .then().statusCode(200)
                .body("domain", is("nothing-here.test"))
                .body("hasLogo", is(false))
                .body("logoEtag", nullValue())
                .body("homeUrl", nullValue());
    }

    @Test
    void logoIsNotFoundForAnUnconfiguredDomain() {
        given().when().get("/branding/nothing-here.test/logo").then().statusCode(404);
    }

    @Test
    void malformedDomainsAreRejected() {
        given().when().get("/branding/not..a..domain").then().statusCode(400);
    }

    @Test
    void writesRequireAuthentication() {
        given().contentType("application/json")
                .body(requestBody(null))
                .when().put("/api/v1/platform/branding/domains/unauth.test")
                .then().statusCode(401);
    }

    @Test
    void writesAreForbiddenForNonOwners() {
        given().header("Authorization",
                        "Bearer " + TestTokenFactory.signWebToken(
                                PlatformTestProfile.NON_OWNER_EMAIL))
                .contentType("application/json")
                .body(requestBody(null))
                .when().put("/api/v1/platform/branding/domains/forbidden.test")
                .then().statusCode(403);
    }

    @Test
    void storedLogoIsServedBackByteForByteWithItsHeaders() {
        putBranding("served.test", requestBody("https://example.test/"));

        Response response = given().when().get("/branding/served.test/logo")
                .then().statusCode(200)
                .header("Content-Type", startsWith("image/svg+xml"))
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Security-Policy", "default-src 'none'; sandbox")
                .header("ETag", notNullValue())
                .extract().response();

        assertArrayEquals(LOGO, response.asByteArray());
    }

    @Test
    void metadataReflectsAStoredDomain() {
        putBranding("metadata.test", requestBody("https://example.test/home"));

        given().when().get("/branding/metadata.test")
                .then().statusCode(200)
                .body("hasLogo", is(true))
                .body("homeUrl", is("https://example.test/home"))
                .body("logoEtag", notNullValue());
    }

    @Test
    void conditionalGetReturns304ForStrongWeakAndWildcardValidators() {
        putBranding("conditional.test", requestBody(null));

        String etag = given().when().get("/branding/conditional.test/logo")
                .then().statusCode(200).extract().header("ETag");

        assertAll(
                () -> assertEquals(304, statusFor(etag), "strong validator"),
                () -> assertEquals(304, statusFor("W/" + etag), "weak validator"),
                () -> assertEquals(304, statusFor("*"), "wildcard"),
                () -> assertEquals(304, statusFor("\"other\", " + etag), "list"),
                () -> assertEquals(200, statusFor("\"stale\""), "stale validator"));
    }

    private static int statusFor(String ifNoneMatch) {
        return given().header("If-None-Match", ifNoneMatch)
                .when().get("/branding/conditional.test/logo")
                .thenReturn().statusCode();
    }

    @Test
    void deletingRevertsTheDomainToTheDefaultLogo() {
        putBranding("removable.test", requestBody(null));

        given().header("Authorization", "Bearer " + ownerToken())
                .when().delete("/api/v1/platform/branding/domains/removable.test")
                .then().statusCode(204);

        given().when().get("/branding/removable.test/logo").then().statusCode(404);
        given().when().get("/branding/removable.test")
                .then().statusCode(200).body("hasLogo", is(false));
    }

    @Test
    void adminListProjectsMetadataWithoutTheImageBytes() {
        putBranding("listed.test", requestBody(null));

        Response response = given().header("Authorization", "Bearer " + ownerToken())
                .when().get("/api/v1/platform/branding/domains")
                .then().statusCode(200).extract().response();

        assertEquals("image/svg+xml",
                response.jsonPath().getString("find { it.domain == 'listed.test' }.logoMime"));
    }

    @Test
    void aSecondWriteReplacesTheStoredLogoAndItsValidator() {
        putBranding("replaced.test", requestBody(null));
        String first = given().when().get("/branding/replaced.test/logo")
                .then().statusCode(200).extract().header("ETag");

        byte[] updated = "<svg id=\"v2\"/>".getBytes(StandardCharsets.UTF_8);
        putBranding("replaced.test", "{\"logoDataUrl\":\"data:image/svg+xml;base64,"
                + Base64.getEncoder().encodeToString(updated) + "\"}");

        Response response = given().when().get("/branding/replaced.test/logo")
                .then().statusCode(200).extract().response();

        assertArrayEquals(updated, response.asByteArray());
        assertNotEquals(first, response.header("ETag"));
    }

    @Test
    void darkLogoIsNotFoundForADomainThatShipsOnlyOne() {
        putBranding("light-only.test", requestBody(null));

        given().when().get("/branding/light-only.test/logo/dark").then().statusCode(404);
        given().when().get("/branding/light-only.test")
                .then().statusCode(200)
                .body("hasLogo", is(true))
                .body("hasDarkLogo", is(false))
                .body("logoDarkEtag", nullValue());
    }

    @Test
    void eachGroundIsServedItsOwnBytesAndValidator() {
        putBranding("two-grounds.test", requestBodyWithDarkLogo());

        Response light = given().when().get("/branding/two-grounds.test/logo")
                .then().statusCode(200).extract().response();
        Response dark = given().when().get("/branding/two-grounds.test/logo/dark")
                .then().statusCode(200)
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Security-Policy", "default-src 'none'; sandbox")
                .extract().response();

        assertAll(
                () -> assertArrayEquals(LOGO, light.asByteArray()),
                () -> assertArrayEquals(DARK_LOGO, dark.asByteArray()),
                () -> assertNotEquals(light.header("ETag"), dark.header("ETag")));
    }

    @Test
    void metadataReportsTheDarkVariantWithoutServingIt() {
        putBranding("dark-meta.test", requestBodyWithDarkLogo());

        String darkEtag = given().when().get("/branding/dark-meta.test/logo/dark")
                .then().statusCode(200).extract().header("ETag");

        given().when().get("/branding/dark-meta.test")
                .then().statusCode(200)
                .body("hasDarkLogo", is(true))
                .body("logoDarkEtag", is(darkEtag.replace("\"", "")));
    }

    @Test
    void conditionalGetOnTheDarkVariantUsesItsOwnValidator() {
        putBranding("dark-conditional.test", requestBodyWithDarkLogo());

        String lightEtag = given().when().get("/branding/dark-conditional.test/logo")
                .then().statusCode(200).extract().header("ETag");
        String darkEtag = given().when().get("/branding/dark-conditional.test/logo/dark")
                .then().statusCode(200).extract().header("ETag");

        assertAll(
                () -> assertEquals(304, darkStatusFor(darkEtag), "its own validator"),
                () -> assertEquals(304, darkStatusFor("W/" + darkEtag), "weak"),
                // The light logo's tag identifies a different representation.
                () -> assertEquals(200, darkStatusFor(lightEtag), "the light validator"));
    }

    private static int darkStatusFor(String ifNoneMatch) {
        return given().header("If-None-Match", ifNoneMatch)
                .when().get("/branding/dark-conditional.test/logo/dark")
                .thenReturn().statusCode();
    }

    @Test
    void aWriteWithoutTheDarkLogoClearsAStoredOne() {
        putBranding("dark-cleared.test", requestBodyWithDarkLogo());
        given().when().get("/branding/dark-cleared.test/logo/dark").then().statusCode(200);

        // A PUT replaces the row, so omitting the field means "no dark variant".
        putBranding("dark-cleared.test", requestBody(null));

        given().when().get("/branding/dark-cleared.test/logo/dark").then().statusCode(404);
        given().when().get("/branding/dark-cleared.test")
                .then().statusCode(200).body("hasDarkLogo", is(false));
        // The light logo is untouched.
        given().when().get("/branding/dark-cleared.test/logo").then().statusCode(200);
    }

    @Test
    void anUnsupportedDarkLogoIsRejected() {
        given().header("Authorization", "Bearer " + ownerToken())
                .contentType("application/json")
                .body("{\"logoDataUrl\":\"" + LOGO_DATA_URL
                        + "\",\"logoDarkDataUrl\":\"data:application/pdf;base64,QUJD\"}")
                .when().put("/api/v1/platform/branding/domains/bad-dark.test")
                .then().statusCode(400);
    }

    @Test
    void adminMetadataCarriesBothVariants() {
        putBranding("dark-admin.test", requestBodyWithDarkLogo());

        given().header("Authorization", "Bearer " + ownerToken())
                .when().get("/api/v1/platform/branding/domains/dark-admin.test")
                .then().statusCode(200)
                .body("logoMime", is("image/svg+xml"))
                .body("logoDarkMime", is("image/svg+xml"))
                .body("logoDarkEtag", notNullValue());
    }

    @Test
    void anInactiveDomainKeepsItsLogoForTheOwnerButNotForVisitors() {
        putBranding("parked.test", requestBodyWithDarkLogo());
        given().header("Authorization", "Bearer " + ownerToken())
                .contentType("application/json")
                .body("{\"logoDataUrl\":\"" + LOGO_DATA_URL
                        + "\",\"logoDarkDataUrl\":\"" + DARK_LOGO_DATA_URL
                        + "\",\"active\":false}")
                .when().put("/api/v1/platform/branding/domains/parked.test")
                .then().statusCode(200);

        // Switched off is switched off for the public read.
        given().when().get("/branding/parked.test/logo").then().statusCode(404);
        given().when().get("/branding/parked.test/logo/dark").then().statusCode(404);

        // But deactivating parks the configuration, so the settings UI can
        // still show it and an edit can still resend the bytes.
        Response light = given().header("Authorization", "Bearer " + ownerToken())
                .when().get("/api/v1/platform/branding/domains/parked.test/logo")
                .then().statusCode(200).extract().response();
        Response dark = given().header("Authorization", "Bearer " + ownerToken())
                .when().get("/api/v1/platform/branding/domains/parked.test/logo/dark")
                .then().statusCode(200).extract().response();

        assertAll(
                () -> assertArrayEquals(LOGO, light.asByteArray()),
                () -> assertArrayEquals(DARK_LOGO, dark.asByteArray()));
    }

    @Test
    void theOwnerLogoReadIsNotPublic() {
        putBranding("owner-only.test", requestBody(null));

        given().when().get("/api/v1/platform/branding/domains/owner-only.test/logo")
                .then().statusCode(401);
        given().header("Authorization",
                        "Bearer " + TestTokenFactory.signWebToken(
                                PlatformTestProfile.NON_OWNER_EMAIL))
                .when().get("/api/v1/platform/branding/domains/owner-only.test/logo")
                .then().statusCode(403);
    }

    @Test
    void theOwnerReadIs404ForADomainWithNoDarkVariant() {
        putBranding("owner-light-only.test", requestBody(null));

        given().header("Authorization", "Bearer " + ownerToken())
                .when().get("/api/v1/platform/branding/domains/owner-light-only.test/logo")
                .then().statusCode(200);
        given().header("Authorization", "Bearer " + ownerToken())
                .when().get("/api/v1/platform/branding/domains/owner-light-only.test/logo/dark")
                .then().statusCode(404);
    }
}
