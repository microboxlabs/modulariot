package com.microboxlabs.miot.core.auth;

import java.sql.Connection;
import java.sql.SQLException;

/** Seeds native organization membership for tests that create organizations with plain JDBC. */
public final class TestMembers {

    private TestMembers() {
    }

    /** Adds {@code email} to the organization {@code slug} as an ACTIVE member; repeat calls are no-ops. */
    public static void addMember(Connection c, String slug, String email, String baseRole) throws SQLException {
        try (var st = c.prepareStatement(
                "INSERT INTO miot_iam.iam_user (email) VALUES (lower(?)) ON CONFLICT DO NOTHING")) {
            st.setString(1, email);
            st.executeUpdate();
        }
        try (var st = c.prepareStatement("INSERT INTO miot_iam.iam_membership "
                + "(organization_id, user_id, base_role, status, source, created_by) "
                + "SELECT o.id, u.id, ?, 'ACTIVE', 'NATIVE', 'test' "
                + "FROM miot_core.organizations o, miot_iam.iam_user u "
                + "WHERE o.slug = ? AND lower(u.email) = lower(?) "
                + "ON CONFLICT (organization_id, user_id) DO NOTHING")) {
            st.setString(1, baseRole);
            st.setString(2, slug);
            st.setString(3, email);
            st.executeUpdate();
        }
    }
}
