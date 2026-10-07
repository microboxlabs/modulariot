package com.microboxlabs.miot.core.iam;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.auth.PlatformTestProfile;
import com.microboxlabs.miot.core.auth.TestTokenFactory;
import com.microboxlabs.miot.core.mail.FakeMailer;
import io.agroal.api.AgroalDataSource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Invitation templates: built-in, then the platform's, then the organization's own. */
@QuarkusTest
@TestProfile(PlatformTestProfile.class)
class MailTemplatesApiTest {

    private static final String ORG = "mail-tpl-org";
    private static final String OWNER = "owner@mailtpl.test";
    private static final String MEMBER = "member@mailtpl.test";
    private static final String ORG_TEMPLATE = "/api/v1/orgs/" + ORG + "/mail-templates/invitation/es";
    private static final String PLATFORM_TEMPLATE = "/api/v1/platform/mail-templates/invitation/es";

    @Inject
    AgroalDataSource ds;

    @Inject
    FakeMailer mailer;

    @BeforeEach
    void seed() throws SQLException {
        mailer.reset();
        exec("INSERT INTO miot_core.organizations (slug, name, tenant_client_id, active, membership_source) "
                + "VALUES ('" + ORG + "', 'Acme', 'mail-tpl-client', true, 'NATIVE')");
        for (String[] m : new String[][] {{OWNER, "OWNER"}, {MEMBER, "MEMBER"}}) {
            exec("INSERT INTO miot_iam.iam_user (email) VALUES ('" + m[0] + "') ON CONFLICT DO NOTHING");
            exec("INSERT INTO miot_iam.iam_membership (organization_id, user_id, base_role) "
                    + "SELECT o.id, u.id, '" + m[1] + "' FROM miot_core.organizations o, miot_iam.iam_user u "
                    + "WHERE o.slug = '" + ORG + "' AND u.email = '" + m[0] + "'");
        }
    }

    @AfterEach
    void clean() throws SQLException {
        exec("DELETE FROM miot_core.mail_template WHERE organization_id IS NULL");
        exec("DELETE FROM miot_core.organizations WHERE slug = '" + ORG + "'");
    }

    @Test
    void anOrganizationUsesItsOwnTemplateThenThePlatformsThenTheBuiltInOne() {
        given().header("Authorization", bearer(OWNER)).when().get(ORG_TEMPLATE)
                .then().statusCode(200)
                .body("source", is("DEFAULT"))
                .body("subject", is("Te invitaron a {{organization}}"))
                .body("html", containsString("{{logoUrl}}"))
                .body("variables", hasItem("link"));

        given().header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL)).contentType("application/json")
                .body(template("Plataforma: {{organization}}", "<p>{{inviter}}</p><a href=\"{{link}}\">ir</a>"))
                .when().put(PLATFORM_TEMPLATE)
                .then().statusCode(200).body("source", is("PLATFORM"));
        given().header("Authorization", bearer(OWNER)).when().get(ORG_TEMPLATE)
                .then().statusCode(200).body("source", is("PLATFORM"));
        assertEquals("Plataforma: Acme", invite("a@mailtpl.test"));

        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(template("Hola de {{organization}}", "<p><img src=\"{{logoUrl}}\"></p>{{link}}"))
                .when().put(ORG_TEMPLATE)
                .then().statusCode(200)
                .body("source", is("ORGANIZATION"))
                .body("updatedBy", is(OWNER));
        assertEquals("Hola de Acme", invite("b@mailtpl.test"));
        String html = mailer.sent().get(1).mail().html();
        assertTrue(html.contains("https://app.example.test/app/email/modulariot-logo.png"), html);

        given().header("Authorization", bearer(OWNER)).when().delete(ORG_TEMPLATE).then().statusCode(204);
        given().header("Authorization", bearer(OWNER)).when().delete(ORG_TEMPLATE).then().statusCode(404);
        given().header("Authorization", bearer(OWNER)).when().get(ORG_TEMPLATE)
                .then().statusCode(200).body("source", is("PLATFORM"));
    }

    @Test
    void aTemplateHasToRenderAndIncludeTheLink() {
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(template("Hola", "<p>Sin enlace</p>"))
                .when().put(ORG_TEMPLATE)
                .then().statusCode(400).body("error", containsString("{{link}}"));
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(template("Hola", "{{link}} {{#if}}"))
                .when().put(ORG_TEMPLATE)
                .then().statusCode(400);
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(template("Hola", "{{link}} {{> secrets}}"))
                .when().put(ORG_TEMPLATE)
                .then().statusCode(400);
        given().header("Authorization", bearer(OWNER)).when().get("/api/v1/orgs/" + ORG + "/mail-templates/x/es")
                .then().statusCode(400);
    }

    @Test
    void thePreviewUsesTheOrganizationsName() {
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(template("{{organization}}", "<b>{{organization}}</b> {{link}}"))
                .when().post(ORG_TEMPLATE + "/preview")
                .then().statusCode(200)
                .body("subject", is("Acme"))
                .body("html", containsString("<b>Acme</b> https://example.com/es/invite/sample-token"));
    }

    @Test
    void onlyAdminsAndPlatformOwnersChangeTemplates() {
        given().header("Authorization", bearer(MEMBER)).when().get(ORG_TEMPLATE).then().statusCode(403);
        given().header("Authorization", bearer(OWNER)).when().get(PLATFORM_TEMPLATE).then().statusCode(403);
        given().header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL)).when().get(PLATFORM_TEMPLATE)
                .then().statusCode(200).body("source", is("DEFAULT"));
    }

    /** Invites one email and returns the subject that was sent. */
    private String invite(String email) {
        mailer.configure("mail-tpl-client");
        int before = mailer.sent().size();
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body("{\"emails\":[\"" + email + "\"],\"lang\":\"es\"}")
                .when().post("/api/v1/orgs/" + ORG + "/team/invitations")
                .then().statusCode(201).body("[0].delivery.status", is("SENT"));
        assertEquals(before + 1, mailer.sent().size());
        return mailer.sent().get(before).mail().subject();
    }

    private static Map<String, String> template(String subject, String html) {
        return Map.of("subject", subject, "html", html);
    }

    private static String bearer(String email) {
        return "Bearer " + TestTokenFactory.signWebToken(email);
    }

    private void exec(String sql) throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.createStatement()) {
            st.executeUpdate(sql);
        }
    }
}
