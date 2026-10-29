package com.microboxlabs.miot.integrations.persistence;

import io.vertx.mutiny.sqlclient.SqlClient;
import java.util.function.Supplier;

/** The connection owned by a blocking provisioning worker, for atomic credential and connection writes. */
public final class ManagedProvisioningTransaction {
    private static final ThreadLocal<SqlClient> CURRENT = new ThreadLocal<>();
    private ManagedProvisioningTransaction() { }

    public static SqlClient client(SqlClient fallback) {
        SqlClient current = CURRENT.get();
        return current == null ? fallback : current;
    }

    public static <T> T run(SqlClient connection, Supplier<T> work) {
        SqlClient previous = CURRENT.get();
        CURRENT.set(connection);
        try {
            return work.get();
        } finally {
            if (previous == null) CURRENT.remove();
            else CURRENT.set(previous);
        }
    }
}
